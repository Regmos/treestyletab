var TreeStyleTabWindowHelper = { 
	
	get service() 
	{
		return TreeStyleTabService;
	},
 
	preInit : function TSTWH_preInit() 
	{
		var source = window.BrowserStartup.toSource();
		if (source.indexOf('!MultipleTabService.tearOffSelectedTabsFromRemote()') > -1) {
			eval('window.BrowserStartup = '+source.replace(
				'!MultipleTabService.tearOffSelectedTabsFromRemote()',
				'!TreeStyleTabService.tearOffSubtreeFromRemote() && $&'
			));
		}
		else if (source.indexOf('gBrowser.swapBrowsersAndCloseOther') > -1) {
			eval('window.BrowserStartup = '+source.replace(
				'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
				'if (!TreeStyleTabService.tearOffSubtreeFromRemote()) { $& }'
			));
		}

		eval('nsBrowserAccess.prototype.openURI = '+
			nsBrowserAccess.prototype.openURI.toSource().replace(
				/(switch\s*\(aWhere\))/,
				<![CDATA[
					if (aOpener &&
						aWhere == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB) {
						TreeStyleTabService.readyToOpenChildTab(aOpener);
					}
					$1]]>
			)
		);

		if ('BrowserOpenTab' in window) {
			eval('window.BrowserOpenTab = '+
				window.BrowserOpenTab.toSource().replace(
					'gBrowser.loadOneTab(',
					'gBrowser.treeStyleTab.onBeforeNewTabCommand(); $&'
				)
			);
		}

		if ('undoCloseTab' in window) {
			eval('window.undoCloseTab = '+
				window.undoCloseTab.toSource().replace(
					/(\btab\s*=\s*[^\.]+\.undoCloseTab\([^;]+\);)/,
					<![CDATA[
						gBrowser.__treestyletab__readyToUndoCloseTab = true;
						$1
						tab.__treestyletab__restoredByUndoCloseTab = true;
						delete gBrowser.__treestyletab__readyToUndoCloseTab;
					]]>
				)
			);
		}

		this.overrideExtensionsPreInit(); // windowHelperHacks.js
	},
 
	onBeforeBrowserInit : function TSTWH_onBeforeBrowserInit() 
	{
		this.overrideExtensionsBeforeBrowserInit(); // windowHelperHacks.js
		this.overrideGlobalFunctions();
	},
 
	onAfterBrowserInit : function TSTWH_onAfterBrowserInit() 
	{
		this.overrideExtensionsAfterBrowserInit(); // windowHelperHacks.js
	},
	
	updateTabDNDObserver : function TSTWH_updateTabDNDObserver(aObserver) 
	{
		var strip = this.service.getTabStrip(aObserver) ||
					gBrowser.mStrip // fallback to the default strip, for Tab Mix Plus;

		// Firefox 4.0 or later
		if (
			aObserver.tabContainer &&
			aObserver.tabContainer.tabbrowser == aObserver &&
			this.service.isGecko2 // tabbar.tabbrowser can be defined by addons like Tab Mix Plus.
			) {
			aObserver = aObserver.tabContainer;
		}

		if ('_setEffectAllowedForDataTransfer' in aObserver) {
			eval('aObserver._setEffectAllowedForDataTransfer = '+
				aObserver._setEffectAllowedForDataTransfer.toSource().replace(
					'{',
					'{ var TSTTabBrowser = this instanceof Ci.nsIDOMElement ? (this.tabbrowser || this) : gBrowser ;'
				).replace(
					/\.screenX/g, '[TSTTabBrowser.treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[TSTTabBrowser.treeStyleTab.sizeProp]'
				).replace(
					/(return (?:true|dt.effectAllowed = "copyMove");)/,
					<![CDATA[
						if (!TSTTabBrowser.treeStyleTab.tabbarDNDObserver.canDropTab(arguments[0])) {
							return dt.effectAllowed = "none";
						}
						$1
					]]>
				).replace(
					'sourceNode.parentNode == this &&',
					'$& TSTTabBrowser.treeStyleTab.getTabFromEvent(event) == sourceNode &&'
				)
			);
		}
	},
 
	overrideGlobalFunctions : function TSTWH_overrideGlobalFunctions() 
	{
		window.__treestyletab__BrowserCustomizeToolbar = window.BrowserCustomizeToolbar;
		window.BrowserCustomizeToolbar = function() {
			TreeStyleTabWindowHelper.destroyToolbarItems();
			window.__treestyletab__BrowserCustomizeToolbar.call(window);
		};

		let (toolbox) {
			toolbox = document.getElementById('navigator-toolbox');
			if (toolbox.customizeDone) {
				toolbox.__treestyletab__customizeDone = toolbox.customizeDone;
				toolbox.customizeDone = function(aChanged) {
					this.__treestyletab__customizeDone(aChanged);
					TreeStyleTabWindowHelper.initToolbarItems();
				};
			}
			if ('BrowserToolboxCustomizeDone' in window) {
				window.__treestyletab__BrowserToolboxCustomizeDone = window.BrowserToolboxCustomizeDone;
				window.BrowserToolboxCustomizeDone = function(aChanged) {
					window.__treestyletab__BrowserToolboxCustomizeDone.apply(window, arguments);
					TreeStyleTabWindowHelper.initToolbarItems();
				};
			}
			this.initToolbarItems();
			toolbox = null;
		}


		eval('nsContextMenu.prototype.openLinkInTab = '+
			nsContextMenu.prototype.openLinkInTab.toSource().replace(
				'{',
				<![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]>
			)
		);
		eval('nsContextMenu.prototype.openFrameInTab = '+
			nsContextMenu.prototype.openFrameInTab.toSource().replace(
				'{',
				<![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]>
			)
		);
		var viewImageMethod = ('viewImage' in nsContextMenu.prototype) ? 'viewImage' : 'viewMedia' ;
		eval('nsContextMenu.prototype.'+viewImageMethod+' = '+
			nsContextMenu.prototype[viewImageMethod].toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);
		eval('nsContextMenu.prototype.viewBGImage = '+
			nsContextMenu.prototype.viewBGImage.toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);
		eval('nsContextMenu.prototype.addDictionaries = '+
			nsContextMenu.prototype.addDictionaries.toSource().replace(
				'openUILinkIn(',
				<![CDATA[
					if (where.indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);

		if ('BrowserSearch' in window &&
			'loadSearch' in BrowserSearch) {
			eval('BrowserSearch.loadSearch = '+
				BrowserSearch.loadSearch.toSource().replace(
					'if (useNewTab) {',
					<![CDATA[$&
						if (TreeStyleTabService.shouldOpenSearchResultAsChild(arguments[0]))
							TreeStyleTabService.readyToOpenChildTab();
					]]>
				)
			);
		}

		this._splitFunctionNames(<![CDATA[
			window.duplicateTab.handleLinkClick
			window.__treestyletab__highlander__origHandleLinkClick
			window.__splitbrowser__handleLinkClick
			window.__ctxextensions__handleLinkClick
			window.handleLinkClick
		]]>).some(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function handleLinkClick/.test(source))
				return false;
			eval(aFunc+' = '+source.replace( // for Firefox 3.5 - Firefox 3.6
				/(openNewTabWith\()/g,
				<![CDATA[
					if (!TreeStyleTabService.checkToOpenChildTab(event.target.ownerDocument.defaultView))
						TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
					$1]]>
			).replace( // for Firefox 4.0-
				/(charset\s*:\s*doc\.characterSet\s*)/,
				'$1, event : event, linkNode : linkNode'
			));
			source = null;
			return true;
		}, this);

		// for Firefox 4.0-
		if ('openLinkIn' in window) {
			eval('window.openLinkIn = '+
				window.openLinkIn.toSource().replace(
					'browser.loadOneTab(',
					<![CDATA[
						if (params.linkNode &&
							!TreeStyleTabService.checkToOpenChildTab(params.linkNode.ownerDocument.defaultView))
							TreeStyleTabService.readyToOpenChildTab(params.linkNode.ownerDocument.defaultView);
						$&]]>.toString()
				)
			);
		}

		this._splitFunctionNames(<![CDATA[
			window.permaTabs.utils.wrappedFunctions["window.contentAreaClick"]
			window.__contentAreaClick
			window.__ctxextensions__contentAreaClick
			window.contentAreaClick
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function contentAreaClick/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				// for Tab Utilities, etc. Some addons insert openNewTabWith() to the function.
				// (calls for the function is not included by Firefox default.)
				/(openNewTabWith\()/g,
				<![CDATA[
					if (!TreeStyleTabService.checkToOpenChildTab(event.target.ownerDocument.defaultView)) TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
					$1]]>
			));
			source = null;
		}, this);

		this._splitFunctionNames(<![CDATA[
			window.duplicateTab.gotoHistoryIndex
			window.duplicateTab.BrowserBack
			window.duplicateTab.BrowserForward
			window.__rewindforward__BrowserForward
			window.__rewindforward__BrowserBack
			window.gotoHistoryIndex
			window.BrowserForward
			window.BrowserBack
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function (gotoHistoryIndex|BrowserForward|BrowserBack)/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				/((?:openUILinkIn|duplicateTabIn)\()/g,
				<![CDATA[
					if (where == 'tab' || where == 'tabshifted')
						TreeStyleTabService.readyToOpenChildTab();
					$1]]>
			));
			source = null;
		}, this);

		this._splitFunctionNames(<![CDATA[
			window.BrowserReloadOrDuplicate
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function (BrowserReloadOrDuplicate)/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				/((?:openUILinkIn|duplicateTabIn)\()/g,
				<![CDATA[
					if (where == 'tab' || where == 'tabshifted')
						TreeStyleTabService.onBeforeTabDuplicate(null);
					$&]]>
			));
			source = null;
		}, this);

		this._splitFunctionNames(<![CDATA[
			permaTabs.utils.wrappedFunctions["window.BrowserHomeClick"]
			window.BrowserHomeClick
			window.BrowserGoHome
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function (BrowserHomeClick|BrowserGoHome)/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				'gBrowser.loadTabs(',
				<![CDATA[
					TreeStyleTabService.readyToOpenNewTabGroup(gBrowser);
					$&]]>
			));
			source = null;
		}, this);

		eval('FeedHandler.loadFeed = '+
			FeedHandler.loadFeed.toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(event, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(gBrowser);
					$&]]>
			)
		);

		// Firefox 3 full screen
		eval('FullScreen._animateUp = '+
			FullScreen._animateUp.toSource().replace(
				// Firefox 3.6 or older
				/(gBrowser\.mStrip\.boxObject\.height)/,
				'((gBrowser.treeStyleTab.position != "top") ? 0 : $1)'
			)
		);
		eval('FullScreen.mouseoverToggle = '+
			FullScreen.mouseoverToggle.toSource().replace(
				// Firefox 4.0 or later
				'this._isChromeCollapsed = !aShow;',
				'gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN); $&'
			).replace(
				// Firefox 3.6 or older
				'gBrowser.mStrip.setAttribute("moz-collapsed", !aShow);',
				'if (gBrowser.treeStyleTab.position == "top") { $& }'
			)
		);
		eval('FullScreen.toggle = '+
			FullScreen.toggle.toSource().replace(
				'{',
				<![CDATA[{
					var treeStyleTab = gBrowser.treeStyleTab;
					if (treeStyleTab.position != 'top') {
						if (window.fullScreen)
							treeStyleTab.autoHide.endForFullScreen();
						else
							treeStyleTab.autoHide.startForFullScreen();
					}
				]]>
			)
		);

		if ('PrintUtils' in window) {
			eval('PrintUtils.printPreview = '+PrintUtils.printPreview.toSource().replace(
				'{',
				'{ TreeStyleTabService.onPrintPreviewEnter();'
			));
			eval('PrintUtils.exitPrintPreview = '+PrintUtils.exitPrintPreview.toSource().replace(
				'{',
				'{ TreeStyleTabService.onPrintPreviewExit();'
			));
		}

		if ('TabsOnTop' in window && TabsOnTop.syncCommand) {
			eval('TabsOnTop.syncCommand = '+TabsOnTop.syncCommand.toSource().replace(
				/(\}\)?)$/,
				'gBrowser.treeStyleTab.onTabsOnTopSyncCommand(enabled); $&'
			));
		}

		if ('toggleSidebar' in window) {
			eval('window.toggleSidebar = '+
				window.toggleSidebar.toSource().replace(
					'{',
					'{ gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_WINDOW_RESIZE);'
				)
			);
		}
	},
	_splitFunctionNames : function TSTWH__splitFunctionNames(aString)
	{
		return String(aString)
				.split(/\s+/)
				.map(function(aString) {
					return aString
							.replace(/\/\*.*\*\//g, '')
							.replace(/\/\/.+$/, '')
							.replace(/^\s+|\s+$/g, '');
				});
	},
	_getFunctionSource : function TSTWH__getFunctionSource(aFunc)
	{
		var func;
		try {
			eval('func = '+aFunc);
		}
		catch(e) {
			return null;
		}
		return func ? func.toSource() : null ;
	},
 
	initToolbarItems : function TSTWH_initToolbarItems() 
	{
		var searchbar = document.getElementById('searchbar');
		if (searchbar &&
			searchbar.doSearch &&
			searchbar.doSearch.toSource().toSource().indexOf('TreeStyleTabService') < 0) {
			eval('searchbar.doSearch = '+searchbar.doSearch.toSource().replace(
				/(openUILinkIn\(.+?\);)/,
				<![CDATA[
					if (TreeStyleTabService.shouldOpenSearchResultAsChild(arguments[0]))
						TreeStyleTabService.readyToOpenChildTab();
					$1
					TreeStyleTabService.stopToOpenChildTab();
				]]>.toString()
			));
		}

		var goButton = document.getElementById('urlbar-go-button') || // Firefox 4 or later
						document.getElementById('go-button'); // Firefox 3.6
		if (goButton)
			goButton.parentNode.addEventListener('click', this.service, true);

		var tabbar = this.service.getTabStrip(this.service.browser);
		tabbar.addEventListener('click', this.service, true);

		var newTabButton = document.getElementById('new-tab-button');
		if (newTabButton &&
			!(tabbar.compareDocumentPosition(newTabButton) & Ci.nsIDOM3Node.DOCUMENT_POSITION_CONTAINED_BY))
			newTabButton.parentNode.addEventListener('click', this.service, true);

		// for Firefox 4.0 or later
		this.service.updateAllTabsButton(gBrowser);

		var event = document.createEvent('Events');
		event.initEvent(this.service.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION, true, false);
		document.documentElement.dispatchEvent(event);
	},
 
	destroyToolbarItems : function TSTWH_destroyToolbarItems() 
	{
		var goButton = document.getElementById('urlbar-go-button') || // Firefox 4 or later
						document.getElementById('go-button'); // Firefox 3.6
		if (goButton)
			goButton.parentNode.removeEventListener('click', this, true);

		var tabbar = this.service.getTabStrip(this.service.browser);
		tabbar.removeEventListener('click', this.service, true);

		var newTabButton = document.getElementById('new-tab-button');
		if (newTabButton &&
			!(tabbar.compareDocumentPosition(newTabButton) & Ci.nsIDOM3Node.DOCUMENT_POSITION_CONTAINED_BY))
			newTabButton.parentNode.removeEventListener('click', this.service, true);

		// Firefox 4.0 or later (restore original position)
		var allTabsButton = document.getElementById('alltabs-button');
		if (allTabsButton && allTabsButton.hasChildNodes())
			allTabsButton.firstChild.setAttribute('position', 'after_end');

		var event = document.createEvent('Events');
		event.initEvent(this.service.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION, true, false);
		document.documentElement.dispatchEvent(event);
	},
  
	initTabbrowserMethods : function TSTWH_initTabbrowserMethods(aTabBrowser) 
	{
		var b = aTabBrowser;

		eval('b.moveTabForward = '+
			b.moveTabForward.toSource().replace(
				'{', '{ var nextTab;'
			).replace(
				'tabPos < this.browsers.length - 1',
				'nextTab = this.treeStyleTab.getNextSiblingTab(this.mCurrentTab)'
			).replace(
				'tabPos + 1', 'nextTab._tPos'
			).replace(
				'this.moveTabTo(',
				<![CDATA[
					var descendant = this.treeStyleTab.getDescendantTabs(nextTab);
					if (descendant.length) {
						nextTab = descendant[descendant.length-1];
					}
					$&]]>
			).replace(
				'this.moveTabToStart();',
				<![CDATA[
					this.treeStyleTab.internallyTabMovingCount++;
					var parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getFirstChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						$&
					}
					this.treeStyleTab.internallyTabMovingCount--;
				]]>
			)
		);

		eval('b.moveTabBackward = '+
			b.moveTabBackward.toSource().replace(
				'{', '{ var prevTab;'
			).replace(
				'tabPos > 0',
				'prevTab = this.treeStyleTab.getPreviousSiblingTab(this.mCurrentTab)'
			).replace(
				'tabPos - 1', 'prevTab._tPos'
			).replace(
				'this.moveTabToEnd();',
				<![CDATA[
					this.treeStyleTab.internallyTabMovingCount++;
					var parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getLastChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						$&
					}
					this.treeStyleTab.internallyTabMovingCount--;
				]]>
			)
		);

		eval('b.loadTabs = '+
			b.loadTabs.toSource().replace(
				'var tabNum = ',
				<![CDATA[
					if (this.treeStyleTab.readiedToAttachNewTabGroup)
						TreeStyleTabService.readyToOpenChildTab(firstTabAdded || this.selectedTab, true);
					$&]]>
			).replace(
				'if (!aLoadInBackground)',
				<![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(this))
						TreeStyleTabService.stopToOpenChildTab(this);
					$&]]>
			).replace(
				'this.selectedTab = firstTabAdded;',
				<![CDATA[
					this.selectedTab = aURIs[0].indexOf('about:treestyletab-group') < 0 ?
						firstTabAdded :
						TreeStyleTabService.getNextTab(firstTabAdded) ;
				]]>
			)
		);

		if ('_beginRemoveTab' in b) {
			eval('b._beginRemoveTab = '+
				b._beginRemoveTab.toSource().replace( // Firefox 3.5-3.6
					'if (l == 1) {',
					'if (l == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
				).replace( // Firefox 4.0-
					'if (this.tabs.length - this._removingTabs.length == 1) {',
					'if (this.tabs.length - this._removingTabs.length == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
				).replace( // Firefox 3.5-
					'this._removingTabs.length == 0',
					'(this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab) || $&)'
				)
			);
		}

		eval('b.removeCurrentTab = '+b.removeCurrentTab.toSource().replace(
			'{',
			'{ if (!this.treeStyleTab.warnAboutClosingTabSubtreeOf(this.selectedTab)) return;'
		));
	},
 
	initTabbarMethods : function TSTWH_initTabbarMethods(aTabBrowser) 
	{
		var b = aTabBrowser;

		var source = b.mTabContainer.advanceSelectedTab.toSource();
		if (source.indexOf('treeStyleTab.handleAdvanceSelectedTab') < 0) {
			eval('b.mTabContainer.advanceSelectedTab = '+
				source.replace(
					'{',
					<![CDATA[$&
						var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;
						if (treeStyleTab.handleAdvanceSelectedTab(arguments[0], arguments[1], this))
							return;
					]]>
				)
			);
		}

		source = b.mTabContainer._notifyBackgroundTab.toSource();
		if (source.indexOf('TreeStyleTabService.getTabBrowserFromChild') < 0) {
			eval('b.mTabContainer._notifyBackgroundTab = '+
				source.replace(
					'{',
					'{ var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;'
				).replace(
					/\.screenX/g, '[treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[treeStyleTab.sizeProp]'
				).replace(
					/\.left/g, '[treeStyleTab.startProp]'
				).replace(
					/\.right/g, '[treeStyleTab.endProp]'
				)
			);
		}

		if (b.tabContainer && '_getDropIndex' in b.tabContainer) { // Firefox 4.0 or later
			eval('b.tabContainer._getDropIndex = '+
				b.tabContainer._getDropIndex.toSource().replace(
					/\.screenX/g, '[this.treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[this.treeStyleTab.sizeProp]'
				)
			);
		}
		else if ('getNewIndex' in b) { // Firefox 3.6 or older
			eval('b.getNewIndex = '+
				b.getNewIndex.toSource().replace(
					/\.screenX/g, '[this.treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[this.treeStyleTab.sizeProp]'
				)
			);
		}

		/**
		 * The default implementation fails to scroll to tab if it is expanding.
		 * So we have to inject codes to override its effect.
		 */
		let (scrollbox = aTabBrowser.treeStyleTab.scrollBox) {
			let source = scrollbox.ensureElementIsVisible.toSource();
			if (
				source.indexOf('treeStyleTab') < 0 && // not updated yet
				source.indexOf('ensureTabIsVisible') < 0 // not replaced by Tab Mix Plus
				) {
				eval('scrollbox.ensureElementIsVisible = '+
					source.replace(
						'{',
						<![CDATA[{
							var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;
							if (
								treeStyleTab &&
								(arguments.length == 1 || arguments[1])
								)
								return treeStyleTab.scrollToTab(arguments[0]);
						]]>.toString()
					)
				);
			}
		}

		let (popup = document.getElementById('alltabs-popup')) {
			if (popup && '_updateTabsVisibilityStatus' in popup) {
				eval('popup._updateTabsVisibilityStatus = '+
					popup._updateTabsVisibilityStatus.toSource().replace(
						'{',
						'{ var treeStyleTab = gBrowser.treeStyleTab;'
					).replace(
						/\.screenX/g, '[treeStyleTab.positionProp]'
					).replace(
						/\.width/g, '[treeStyleTab.sizeProp]'
					)
				);
			}
		}
	
	}
 
}; 
  
