/*jslint plusplus: true, vars: true, browser: true, white:true, nomen :true, sloppy:true, continue:true */
/*global d3, google */

/*********************************

keshif library

Copyright (c) 2013, Mehmet Adil Yalcin
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the University of Maryland nor the names of its contributors 
  may not be used to endorse or promote products derived from this software 
  without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL MICHAEL BOSTOCK BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

************************************ */

// load google visualization library only if google scripts were included
if(typeof google !== 'undefined'){
    google.load('visualization', '1', {'packages': []});
}

if(typeof sendLog !== 'function'){
    sendLog = null;
}

// kshf namespace
var kshf = {
    queryURL_base: 'https://docs.google.com/spreadsheet/tq?key=',
    surrogateCtor: function() {},
    // http://stackoverflow.com/questions/4152931/javascript-inheritance-call-super-constructor-or-use-prototype-chain
    extendClass: function(base, sub) {
      // Copy the prototype from the base to setup inheritance
      this.surrogateCtor.prototype = base.prototype;
      // Tricky huh?
      sub.prototype = new this.surrogateCtor();
      // Remember the constructor property was set wrong, let's fix it
      sub.prototype.constructor = sub;
    },
    num_of_charts: 0,
    num_of_browsers: 0,
    maxVisibleItems_default: 50, 
    dt: {},
    dt_id: {},
    dt_ColNames: {},
    dt_ColNames_Arr: {},
    createColumnNames: function(tableName){
        this.dt_ColNames    [tableName] = {};
        this.dt_ColNames_Arr[tableName] = [];
    },
    insertColumnName: function(tableName, colName, index){
        this.dt_ColNames    [tableName][colName] = index;
        this.dt_ColNames_Arr[tableName][index  ] = colName;
    },
};


kshf.Util = {
    dif_activeItems: function(a,b){
        return b.activeItems - a.activeItems;
    },
    dif_barValue: function(a,b){
        return b.barValue - a.barValue;
    },
    sortFunc_ActiveCount_TotalCount: function(a,b){ 
        var dif=kshf.Util.dif_activeItems(a,b);
        if(dif===0) { return b.items.length-a.items.length; }
        return dif;
    },
    sortFunc_Column_Int_Incr: function(a,b){ 
        return a.data[1] - b.data[1]; 
    },
    sortFunc_Column_Int_Decr: function(a,b){ 
        return b.data[1] - a.data[1]; 
    },
    sortFunc_Column_ParseInt_Incr: function(a,b){ 
        return parseFloat(a.data[1],10) -parseFloat(b.data[1],10);
    },
    sortFunc_Column_ParseInt_Decr: function(a,b){ 
        return parseFloat(b.data[1],10) -parseFloat(a.data[1],10);
    },
    sortFunc_String_Decr: function(a,b){ 
        return b.data[1].localeCompare(a.data[1]);
    },
    sortFunc_String_Incr: function(a,b){ 
        return b.data[1].localeCompare(a.data[1]);
    },
    sortFunc_Time_Last: function(a, b){
        if(a.xMax_Dyn!==undefined && b.xMax_Dyn!==undefined){
            return b.xMax_Dyn - a.xMax_Dyn;
        }
        if(a.xMax_Dyn===undefined && b.xMax_Dyn===undefined){
            return b.xMax - a.xMax;
        }
        if(b.xMax_Dyn===undefined){ return -1; }
        return 1;
    },
    sortFunc_Time_First: function(a, b){
        if(a.xMax_Dyn!==undefined && b.xMax_Dyn!==undefined){
            return a.xMin_Dyn - b.xMin_Dyn;
        }
        if(a.xMax_Dyn===undefined && b.xMax_Dyn===undefined){
            return a.xMin - b.xMin;
        }
        if(b.xMin_Dyn===undefined){ return -1; }
        return 1;
    },
    sortFunc_List_String: function(a, b){
        return a.localeCompare(b);
    },
    sortFunc_List_Date: function(a, b){
        if(a===null) return -1;
        if(b===null) return 1;
        return a.getTime() - b.getTime();
    },
    sortFunc_List_Number: function(a, b){
        return b - a;
    },
    /** Given a list of columns which hold multiple IDs, breaks them into an array */
    cellToArray: function(dt, columns, splitExpr, convertInt){
        if(splitExpr===undefined){
            splitExpr = /\b\s+/;
        }
        var j;
        dt.forEach(function(p){
            p = p.data;
            columns.forEach(function(column){
                var list = p[column];
                if(list===null) return;
                if(typeof list==="number") return;
                var list2 = list.split(splitExpr);
                list = [];
                // remove empty "" items
                for(j=0; j<list2.length; j++){
                    list2[j] = list2[j].trim();
                    if(list2[j]!=="") list.push(list2[j]);
                }
                // convert to int - TODO: what if the IDs are string?
                if(convertInt!==false){
                    for(j=0; j<list.length; j++){
                        list[j] = parseInt(list[j],10);
                    }
                }
                p[column] = list;
            });
        });
    },
    unescapeCommas: function(c){
        var k=0,j;
        var escaped=false;
        var cell;
        var a=[];
        c.forEach(function(c_i){
            if(escaped){
                cell+=","+c_i;
                if(c_i[c_i.length-1]==="\""){
                    escaped=false;
                } else {
                    return;
                }
            } else {
                if(c_i[0]==="\""){
                    escaped = true;
                    cell = c_i.slice(1,c_i.length-1);
                    return;
                }
                cell = c_i;
            }
            // convert to num
            var n=+cell;
            if(!isNaN(n) && cell!==""){
                cell=n;
            } else {/*
                // convert to date
                var dt = Date.parse(cell);
                if(!isNaN(dt)){ cell = new Date(dt); } */
            }
            a.push(cell);
        });
        return a;
    },
    /** You should only display at most 3 digits + k/m/etc */
    formatForItemCount: function(n){
        if(n<1000) {
            return n;
        }
        if(n<1000000) {
            // 1,000-999,999
            var thousands=n/1000;
            if(thousands<10){
                return (Math.floor(n/100)/10)+"k";
            }
            return Math.floor(thousands)+"k";
        }
        if(n<1000000000) return Math.floor(n/1000000)+"m";
        return n;
    },
    nearestYear: function(d){
        var dr = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        if(d.getUTCMonth()>6) dr.setUTCFullYear(dr.getUTCFullYear()+1);
        return dr;
    },
    nearestMonth: function(d){
        var dr = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));
        if(d.getUTCDate()>15) dr.setUTCMonth(dr.getUTCMonth()+1);
        return dr;
    },
    nearestDay: function(d){
        var dr = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
        if(d.getUTCHours()>12) dr.setUTCDate(dr.getUTCDate()+1);
        return dr;
    },
    nearestHour: function(d){
    },
    nearestMinute: function(d){
    },
    /** -- ANY of the mappins is true */
    filter_multi_or: function(itemList) {
        var r=false;
        itemList.every(function(d){
            if(d.f_included()) r=true;
            return !r;
        });
        return r;
    },
    filter_multi_removed: function(itemList){
        return ! itemList.every(function(d){
            return ! d.f_removed();
        })
    },
    ignoreScrollEvents: false,
    scrollToPos_do: function(scrollDom, targetPos){
        kshf.Util.ignoreScrollEvents = true;
        // scroll to top
        var startTime = null;
        var scrollInit = scrollDom.scrollTop;
        var easeFunc = d3.ease('cubic-in-out');
        var scrollTime = 500;
        var animateToTop = function(timestamp){
            var progress;
            if(startTime===null) startTime = timestamp;
            // complete animation in 500 ms
            progress = (timestamp - startTime)/scrollTime;
            var m=easeFunc(progress);
            scrollDom.scrollTop = (1-m)*scrollInit+m*targetPos;
            if(scrollDom.scrollTop!==targetPos){
                window.requestAnimationFrame(animateToTop);
            } else {
                kshf.Util.ignoreScrollEvents = false;
            }
        };
        window.requestAnimationFrame(animateToTop);
    },
};



var CATID = {
    FacetFilter   : 1,
    FacetSort     : 2,
    FacetScroll   : 3,
    FacetCollapse : 4,
    ItemBased     : 5,
    Configuration : 6,
    Other         : 7
};
                        // ## Send update at the end of interaction
var ACTID_FILTER = {
    CatValueAdd    : 1,
    CatValueRemove : 2,
    CatValueExact  : 3,
    ClearOnSummary : 4,
    ClearOnFacet   : 5,
    ClearAll       : 6,
    TimeMinHandle  : 7, // ##
    TimeMaxHandle  : 8, // ##
    TimeDragRange  : 9, // ##
    TimeDot        : 10,
    CatTextSearch  : 11,
    MainTextSearch : 12,
    ClearAllEscape : 13
};
var ACTID_SORT = {
    ChangeSortFunc : 1,
    ResortButton   : 2
};
var ACTID_SCROLL = {
    DragScrollbar : 1, // ##
    MouseScroll   : 2, // ##
    ClickScrollbar: 3,
    ScrollToTop   : 4,
    ClickMore     : 5
};
var ACTID_COLLAPSE = {
    Collapse : 1,
    Show     : 2
};
var ACTID_ITEM = {
    Collapse  : 1,
    Show      : 2,
    FollowURL : 3,
    FollowPDF : 4
};
var ACTID_CONFIG= {
    WindowSize : 1,
    Browser : 2
};
var ACTID_OTHER = {
    DataSource : 1,
    InfoButton : 2,
    OpenPage   : 3, // load
    ClosePage  : 4,  // unload
    LeftPanelWidth: 5,
    Resize     : 6,
    ShowMoreResults: 7
};

// tipsy, facebook style tooltips for jquery
// Modified / simplified version for internal Keshif use
// version 1.0.0a
// (c) 2008-2010 jason frame [jason@onehackoranother.com]
// released under the MIT license

function Tipsy(element, options) {
    this.jq_element = $(element);
    this.options = $.extend({}, this.defaults, options);
};
Tipsy.prototype = {
    defaults: {
        className: null,
        delayOut: 0,
        fade: false,
        fallback: '',
        gravity: 'n',
        offset: 0,
        offset_x: 0,
        offset_y: 0,
        opacity: 0.9
    },
    show: function() {
        var maybeCall = function(thing, ctx) {
            return (typeof thing == 'function') ? (thing.call(ctx)) : thing;
        };

        var title = this.getTitle();
        if(!title) return;
        var jq_tip = this.tip();
        
        jq_tip.find('.tipsy-inner')['html'](title);
        jq_tip[0].className = 'tipsy'; // reset classname in case of dynamic gravity
        jq_tip.remove().css({top: 0, left: 0, visibility: 'hidden', display: 'block'}).prependTo(document.body);
        
        var pos = $.extend({}, this.jq_element.offset(), {
            width: this.jq_element[0].offsetWidth,
            height: this.jq_element[0].offsetHeight
        });
        
        var actualWidth = jq_tip[0].offsetWidth,
            actualHeight = jq_tip[0].offsetHeight,
            gravity = maybeCall(this.options.gravity, this.jq_element[0]);
        
        var tp;
        switch (gravity.charAt(0)) {
            case 'n':
                tp = {top: pos.top + pos.height + this.options.offset, left: pos.left + pos.width / 2 - actualWidth / 2};
                break;
            case 's':
                tp = {top: pos.top - actualHeight - this.options.offset, left: pos.left + pos.width / 2 - actualWidth / 2};
                break;
            case 'e':
                tp = {top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth - this.options.offset};
                break;
            case 'w':
                tp = {top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width + this.options.offset};
                break;
        }
        tp.top+=this.options.offset_y;
        tp.left+=this.options.offset_x;
        
        if (gravity.length == 2) {
            if (gravity.charAt(1) == 'w') {
                tp.left = pos.left + pos.width / 2 - 15;
            } else {
                tp.left = pos.left + pos.width / 2 - actualWidth + 15;
            }
        }
        
        jq_tip.css(tp).addClass('tipsy-' + gravity);
        jq_tip.find('.tipsy-arrow')[0].className = 'tipsy-arrow tipsy-arrow-' + gravity.charAt(0);
        if (this.options.className) {
            jq_tip.addClass(maybeCall(this.options.className, this.jq_element[0]));
        }
        
        if (this.options.fade) {
            jq_tip.stop().css({opacity: 0, display: 'block', visibility: 'visible'}).animate({opacity: this.options.opacity},200);
        } else {
            jq_tip.css({visibility: 'visible', opacity: this.options.opacity});
        }
    },
    hide: function() {
        if (this.options.fade) {
            this.tip().stop().fadeOut(200,function() { $(this).remove(); });
        } else {
            this.tip().remove();
        }
    },
    getTitle: function() {
        var title, jq_e = this.jq_element, o = this.options;
        var title, o = this.options;
        if (typeof o.title == 'string') {
            title = jq_e.attr(o.title == 'title' ? 'original-title' : o.title);
        } else if (typeof o.title == 'function') {
            title = o.title.call(jq_e[0]);
        }
        title = ('' + title).replace(/(^\s*|\s*$)/, "");
        return title || o.fallback;
    },
    tip: function() {
        if(this.jq_tip) return this.jq_tip;
        this.jq_tip = $('<div class="tipsy"></div>').html('<div class="tipsy-arrow"></div><div class="tipsy-inner"></div>');
        this.jq_tip
            ;
        this.jq_tip.data('tipsy-pointee', this.jq_element[0]);
        return this.jq_tip;
    },
};



/**
 * @constructor
 */
kshf.Item = function(d, idIndex, primary){
    // the main data within item
    this.data = d;
    this.idIndex = idIndex; // TODO: Items don't need to have ID index, only one per table is enough!
    // 1:  selected for inclusion
    // -1: selected for removal
    // 0: not selected
	this.selected = 1;
    // used by attributes
    this.items = []; // items which are mapped/related to this item.
	this.activeItems = 0; // If primary item, activeItems is the number of active linked items
    this.barValue = 0;
    this.barValueMax = 0;
    // An item can be loaded as non-primary first, but used as primary for another chart, so, always incldue this info
//    if(primary){
        this.filterCache = [];
        this.barCount = 1; // 1 by default
        this.wanted = true;
        this.wantedOrder = 0; // some default. Used by listDisplay to adjust animations
        this.mappedItems = [];
        // accessed with filterID, the data that's used for mapping this item
        this.mappedData = []; // caching the values this item was mapped to
        // DOM elements of this primary item
        this.mappedDotDOMs = [];
        this.mappedAttribDOMs = [];
        this.dirtyFilter = true;
//    }
};
kshf.Item.prototype = {
    /**
     * Returns unique ID of the item.
     */
    id: function(){
        return this.data[this.idIndex];
    },
    /** -- */
    setFilter: function(index,v){
        if(this.filterCache[index]===v) return;
        this.filterCache[index] = v;
        this.dirtyFilter = true;
    },

    /** -- */
    f_selected: function(){ return this.selected !== 0; },
    f_included: function(){ return this.selected === 1; },
    f_removed:  function(){ return this.selected ===-1; },

    f_unselect: function(){ this.selected = 0; },
    f_include:  function(){ this.selected = 1; },
    f_remove:   function(){ this.selected =-1; },

    /** -- */
    addItem: function(item){
        this.items.push(item);
        this.activeItems++;
        this.barValue+=item.barCount;
        this.barValueMax+=item.barCount;
        this.sortDirty = true;
        item.mappedItems.push(this);
    },
    /**
     * Updates wanted state, and notifies all related filter attributes of the change.
     */
    updateSelected: function(){
        if(!this.dirtyFilter) return;

        var me=this;
        var oldSelected = this.wanted;

        // checks if all filter results are true
        // At first "false", breaks the loop
        this.wanted=true;
        this.filterCache.every(function(f){
            me.wanted=me.wanted&&f;
            return me.wanted;
        });
        
        if(this.wanted===true && oldSelected===false){
            this.browser.itemsSelectedCt++;
            this.mappedItems.forEach(function(attrib){
                attrib.activeItems++;
                attrib.barValue+=me.barCount;
                attrib.sortDirty=true;
            });
            this.mappedDotDOMs.forEach(function(d){
                d.setAttribute('display',"true");
            });
        } else if(this.wanted===false && oldSelected===true){
            this.browser.itemsSelectedCt--;
            this.mappedItems.forEach(function(attrib){
                attrib.activeItems--;
                attrib.barValue-=me.barCount;
                attrib.sortDirty=true;
            });
            this.mappedDotDOMs.forEach(function(d){
                d.setAttribute('display',"false");
            });
        }
        this.dirtyFilter = false;
    },
    updateSelected_SelectOnly: function(){
        if(!this.wanted) this.updateSelected();
    },
    updateSelected_UnSelectOnly: function(){
        if(this.wanted) this.updateSelected();
    },
    /** Highlights all the time components of this item */
    highlightTime: function(){
        this.mappedDotDOMs.forEach(function(d){d.setAttribute('highlight',true);});
    },
    /** Highlights all attributes of this item */
    highlightAttribs: function(){
        this.mappedAttribDOMs.forEach(function(d){d.setAttribute('highlight',"true");});
    },
    /** Highlights the list item */
    highlightListItem: function(){
        if(this.listItem === undefined) return;
        this.listItem.setAttribute("highlight",true);
    },
    /** Higlights all relevant UI parts to this UI item - Attributes, dots, and list */
    highlightAll: function(){
        this.highlightTime();
        this.highlightAttribs();
        this.highlightListItem();
    },
    /** Removes higlight from all the time components of this item */
    nohighlightTime: function(){
        this.mappedDotDOMs.forEach(function(d){d.setAttribute('highlight',false);});
    },
    /** Removes higlight from all attributes of this item */
    nohighlightAttribs: function(){
        this.mappedAttribDOMs.forEach(function(d){d.setAttribute('highlight',"false");});
    },
    /** Removes higlight from the list item */
    nohighlightListItem: function(){
        if(this.listItem)
            this.listItem.setAttribute("highlight",false);
    },
    /** Removes higlight from all relevant UI parts to this UI item - Attributes, dots, and list */
    nohighlightAll: function(){
        this.nohighlightTime();
        this.nohighlightAttribs();
        this.nohighlightListItem();
    }
};

kshf.Filter = function(opts){
    this.isFiltered = false;
    this.filterSummaryBlock = null;

    this.name = opts.name
    this.browser = opts.browser;
    this.onClear = opts.onClear;
    this.hideCrumb = opts.hideCrumb;
    this.text_header = opts.text_header;
    this.text_item = opts.text_item;
    if(opts.cb_this)
        this.cb_this = opts.cb_this;
    else
        this.cb_this = this;

    this.id = this.browser.maxFilterID;
    ++this.browser.maxFilterID;
    this.isFiltered = false;
    this.browser.items.forEach(function(item){ item.setFilter(this.id,true); },this);
};
kshf.Filter.prototype = {
    addFilter: function(forceUpdate){
        this.isFiltered = true;
        this.refreshFilterSummary();
        if(forceUpdate===true){
            this.browser.update();
        }
    },
    clearFilter: function(forceUpdate){
        if(!this.isFiltered) return;
        this.isFiltered = false;
        this.browser.items.forEach(function(item){ item.setFilter(this.id,true); },this);
        this.refreshFilterSummary();
        this.onClear.call(this.cb_this);
        if(forceUpdate===true){
            this.browser.items.forEach(function(item){
                item.updateSelected_SelectOnly();
            });
            this.browser.update();
        }
    },

    /** Don't call this directly */
    refreshFilterSummary: function(){
        if(this.hideCrumb===undefined && this.browser.subBrowser!==true && this.browser.isSmallWidth()){
            this.hideCrumb = true;
        }
        if(this.hideCrumb===true) return;
        if(!this.isFiltered){
            var root = this.filterSummaryBlock;
            if(root===null || root===undefined) return;
            root.attr("ready",false);
            setTimeout(function(){ root[0][0].parentNode.removeChild(root[0][0]); }, 350);
            this.filterSummaryBlock = null;
        } else {
            // insert DOM
            if(this.filterSummaryBlock===null) {
                this.filterSummaryBlock = this.insertFilterSummaryBlock();
            }
            if(this.text_header!==undefined){
                var text = this.text_header;
                if(typeof text === 'function'){
                    text = text.call(this.cb_this, this);
                }
                if(this.browser.subBrowser===true){
                    text += " ("+this.browser.itemName+")";
                }
                this.filterSummaryBlock.select(".txttt").html(text+": ");
            }
            if(this.text_item!==undefined){
                var text = this.text_item;
                if(typeof text === 'function'){
                    text = text.call(this.cb_this, this);
                }
                this.filterSummaryBlock.select(".filter_item").html(text);
            }
        }
    },
    /** Inserts a summary block to the list breadcrumb DOM */
    /** Don't call this directly */
    insertFilterSummaryBlock: function(){
        var x;
        var me=this;
        x = this.browser.dom.filtercrumbs
            .append("span").attr("class","filter-block")
            ;
        x.append("span").attr("class","chartClearFilterButton summary").text("x")
            .each(function(d){
                this.tipsy = new Tipsy(this, {
                    gravity: 'n',
                    fade: true,
                    opacity: 1,
                    title: function(){ 
                        return "<span class='big'>x</span class='big'> <span class='action'>Remove</span> filter"; 
                    }
                })
            })
            .on("click",function(){
                this.tipsy.hide();
                me.clearFilter(true);
                if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.ClearOnSummary,
                    kshf_.getFilteringState(me.name));
            })
            .on("mouseover",function(){
                this.tipsy.show();
            })
            .on("mouseout",function(d,i){
                this.tipsy.hide();
                d3.event.stopPropagation();
            })
            ;
        var y = x.append("span").attr("class","sdsdsds");
        y.append("span").attr("class","txttt");
        y.append("span").attr("class","filter_item");
        // animate appear
        window.getComputedStyle(x[0][0]).opacity;
        x.attr("ready",true);
        return x;
    }
};

/**
 * The list UI
 * @constructor
 */
kshf.List = function(kshf_, config, root){
    var me = this;
    this.itemtoggledetailsWidth = 22;
    this.itemBarWidth_Max = 50;
    this.parentKshf = kshf_;
    this.dom = {};

    this.linkFilterWidth = 65;

    this.maxVisibleItems = kshf.maxVisibleItems_default;
    
    // Sorting options
    this.sortingOpts = config.sortingOpts;
    this.sortingOpts.forEach(function(sortOpt){
        if(sortOpt.value===undefined) sortOpt.value = kshf_.columnAccessFunc(sortOpt.name);
        if(!sortOpt.label) sortOpt.label = sortOpt.value;
        if(sortOpt.inverse===undefined) sortOpt.inverse = false;
        if(sortOpt.func===undefined) sortOpt.func = me.getSortFunc(sortOpt.value);
    });
    this.sortingOpt_Active = this.sortingOpts[0];
    this.sortingOpt_ActiveIndex = 0;

    this.displayType = 'list';
    if(config.displayType==='grid') this.displayType = 'grid';

    this.sortColWidth = config.sortColWidth;

    this.textSearch = config.textSearch;
    this.textSearchFunc = config.textSearchFunc;
    if(this.textSearch!==undefined){
        if(this.textSearchFunc===undefined){
            this.textSearchFunc = this.getKshf().columnAccessFunc(this.textSearch);
        }
        if(this.textSearch[0]==="*")
            this.textSearch = this.textSearch.substring(1);
        // decapitalize
        this.textSearch= this.textSearch.charAt(0).toLowerCase() + this.textSearch.slice(1);
    }

    if(config.content!==undefined){
        config.contentFunc = this.getKshf().columnAccessFunc(config.content);
    }

    this.hideTextSearch = (this.textSearchFunc===undefined);

    this.contentFunc = config.contentFunc;

    this.itemLink = config.itemLink;
    this.itemLinkFunc = config.itemLinkFunc;
    this.itemLinkText = config.itemLinkText;
    if(this.itemLinkFunc===undefined && this.itemLink!==undefined){
        this.itemLinkFunc = this.getKshf().columnAccessFunc(this.itemLink);
    }
    if(this.itemLink!==undefined){
        this.linkFilter = this.getKshf().createFilter({
            name: "listItemLink",
            browser: this.getKshf(),
            onClear: this.clearFilter_Links,
            text_header: this.itemLink,
            text_item: this.textItemFunc,
            cb_this: this
        });
    }

    this.detailsToggle = config.detailsToggle;
    if(this.detailsToggle === undefined) { this.detailsToggle = "Off"; }
    this.detailsDefault = config.detailsDefault;
    if(this.detailsDefault === undefined) { this.detailsDefault = false; }
    if(this.detailsToggle==="One") this.detailsDefault=false;

	this.listDiv = root
        .attr('showAll',this.detailsDefault?'false':'true')
        .attr('detailsToggle',this.detailsToggle);

    var xasdad = this.listDiv.append("div")
        .style("position","relative")
        .style("overflow","hidden")
        ;

    this.dom.listHeader=xasdad.append("div").attr("class","listHeader");

    this.dom.scrollToTop = this.dom.listHeader.append("span").attr("class","scrollToTop")
        .html("⬆")
        .attr("title","Scroll To Top")
        .on("click",function(d){
            kshf.Util.scrollToPos_do(me.dom.listItemGroup[0][0],0);
        });

    this.dom.listItemGroup=xasdad.append("div").attr("class","listItemGroup")
        .on("scroll",function(d){
            if(this.scrollHeight-this.scrollTop-this.offsetHeight<10){
                me.dom.showMore.style("bottom","4px");
            } else{
                me.dom.showMore.style("bottom","-25px");
            }
            me.dom.scrollToTop.style("visibility", this.scrollTop>0?"visible":"hidden");
        });

    if(this.itemLink!==undefined){
        this.insertItemLinkBar_Header();
    }

    // TODO: if sorting column is shown...
    this.sortFilters = [];
    if(this.displayType==='list'){
        this.sortingOpts.forEach(function(sortingOpt){
            me.sortFilters.push(
                kshf_.createFilter({
                    name: sortingOpt.name,
                    browser: me.getKshf(),
                    onClear: me.clearFilter_Sort,
                    text_header: sortingOpt.name,
                    text_item: me.textItemFunc_Sort,
                    cb_this: this
                })
                );
        });
    }

    this.insertSortSelect();
    this.insertItemsToggleDetails();

    if(this.hideTextSearch!==true){
        this.insertTextSearch();
    }

    // apply itemLinkFunc
    this.filteringItem = null;
    if(this.itemLink){
        var items = this.getKshfItems();
        var itemIDMap = kshf.dt_id[this.getKshf().primaryTableName];
        items.forEach(function(item){
            item.items = []; // items that this item is mapped to
            // TODO: Set filter value for the item (filtered or not)
            var toMap = this.itemLinkFunc(item);
            // toMap stores the itemss that this current item is linked to.
            if(toMap===undefined || toMap==="") { 
                toMap=null;
                item.mappedData[this.linkFilter.id] = null;
            } else if(toMap instanceof Array){
                // remove duplicate values in the array
                var found = {};
                toMap = toMap.filter(function(e){
                    if(found[e]===undefined){
                        found[e] = true;
                        return true;
                    }
                    return false;
                });
                item.mappedData[this.linkFilter.id] = [];
                toMap.forEach(function(m){
                    var targetItem = itemIDMap[m];
                    if(targetItem===undefined) return;
                    item.mappedData[this.linkFilter.id].push(targetItem);
                    targetItem.items.push(item);
                    targetItem.activeItems++;
                    item.mappedItems.push(targetItem);
                });
            } else {
                var targetItem = itemIDMap[toMap];
                if(targetItem===undefined) return;
                item.mappedData[this.linkFilter.id] = targetItem;
                targetItem.items.push(item);
                targetItem.activeItems++;
                item.mappedItems.push(targetItem);
            }
            // Push the current item in mappings for the target item.
            item.f_unselect(); // no main item is selected for filtering
        },this);
        this.linkFilter.clearFilter(false);
    }

    this.sortItems();
    this.insertItems();

    // insert "show more" thing...
    this.dom.showMore = xasdad.append("div").attr("class","showMore")
        .on("click",function(){
            me.maxVisibleItems *= 2;
            me.updateItemVisibility(true);
            this.style.bottom = "-25px";
            if(sendLog) sendLog(CATID.Other,ACTID_OTHER.ShowMoreResults);
        })
        ;
    this.dom.showMore.append("span").attr("class","MoreText").html("Show More");
    this.dom.showMore.append("span").attr("class","Count CountAbove");
    this.dom.showMore.append("span").attr("class","Count CountBelow");
    this.dom.showMore.append("span").attr("class","dots dots_1").html("");
    this.dom.showMore.append("span").attr("class","dots dots_2").html("");
    this.dom.showMore.append("span").attr("class","dots dots_3").html("");
};
kshf.List.prototype = {
    /** get parent keshif */
    getKshf: function(){
        return this.parentKshf;
    },
    /** get parent keshif */
    getKshfItems: function(){
        return this.parentKshf.items;
    },
    updateWantedItemList: function(){
        var arr = [];
        var allItems = this.getKshfItems();
        for(var i=0; i<allItems.length ; i++ ){
            if(allItems[i].wanted) arr.push();
        };
        this.wantedItems = arr;
    },
    /* -- */
    insertTextSearch: function(){
        var me=this;
        var listHeaderTopRowTextSearch;

        var clearTextSearch_cb = function(){
            me.dom.bigTextSearch[0][0].value = '';
            listHeaderTopRowTextSearch.select("span").style('display','none');
        };
        this.textFilter = this.getKshf().createFilter({
            name: "TextSearch",
            browser: this.getKshf(),
            onClear: clearTextSearch_cb,
            hideCrumb: true,
            cb_this: this
        });
        var filterId = this.textFilter.id;

        listHeaderTopRowTextSearch = this.dom.listHeader.append("span").attr("class","mainTextSearch");
        listHeaderTopRowTextSearch.append("svg")
            .attr("class","searchIcon")
            .attr("width","13")
            .attr("height","12")
            .attr("viewBox","0 0 491.237793 452.9882813")
            .attr("xmlns","http://www.w3.org/2000/svg")
            .append("use").attr("xlink:href","#kshf_svg_search")
            ;
        this.dom.bigTextSearch = listHeaderTopRowTextSearch.append("input").attr("class","bigTextSearch")
            .attr("placeholder","Search "+(this.textSearch?this.textSearch:"title"))
            .attr("autofocus","true")
            .on("keydown",function(){
                if(this.timer){
                    clearTimeout(this.timer);
                    this.timer = null;
                }
                var x = this;
                this.timer = setTimeout( function(){
                    var v=x.value.toLowerCase();
                    listHeaderTopRowTextSearch.select("span").style('display',(v==='')?'none':'inline-block');
                    var v=v.split(" ");

                    // go over all the items in the list, search each keyword separately
                    me.getKshfItems().forEach(function(item){
                        var f = true;
                        v.every(function(v_i){
                            f = f && me.textSearchFunc(item).toLowerCase().indexOf(v_i)!==-1;
                            return f;
                        });
                        item.setFilter(filterId,f);
                        item.updateSelected();
                    });
                    x.timer = null;
                    if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.MainTextSearch,me.getKshf().getFilteringState());
                    me.textFilter.addFilter(true);
                }, 750);
            });
        listHeaderTopRowTextSearch.append("span")
            .append("svg")
                .attr("class","clearText")
                .attr("width","15")
                .attr("height","15")
                .attr("viewBox","0 0 48 48")
                .attr("xmlns","http://www.w3.org/2000/svg")
                .append("use").attr("xlink:href","#kshf_svg_clearText")
            .on("click",function() {
                if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.MainTextSearch,me.getKshf().getFilteringState());
                me.textFilter.clearFilter(true);
            });
    },
    /** Insert items into the UI, called once on load */
    insertItems: function(){
        var me = this;

        this.dom.listItems = this.dom.listItemGroup.selectAll("div.listItem")
            // if content Func is not defined, provide an empty list
            .data((this.contentFunc===undefined?[]:this.getKshfItems()), function(d){ return d.id(); })
        .enter()
            .append("div")
            .attr("class","listItem")
            .attr("details",this.detailsDefault?"true":"false")
            .attr("highlight",false)
            .attr("animSt","visible")
            .attr("itemID",function(d){return d.id();})
            // store the link to DOM in the data item
            .each(function(d){ d.listItem = this; })
            .on("mouseover",function(d,i){
                d3.select(this).attr("highlight","true");
                d.highlightAll();
            })
            .on("mouseout",function(d,i){
                d3.select(this).attr("highlight","false");
                // find all the things that  ....
                d.nohighlightAll();
            });
        
        if(this.itemLink!==undefined){
            this.insertItemLinkBar();
        }
        if(this.displayType==='list'){
            this.insertItemSortCoumn();
        }
        if(this.detailsToggle!=="Off"){
            this.insertItemToggleDetails();
        }

        this.dom.listItems_Content = this.dom.listItems
            .append("div")
            .attr("class","content")
            .html(function(d){ return me.contentFunc(d);});
    },
    /** Insert sort column into list items */
    insertItemSortCoumn: function(){
        var me=this;
        this.dom.listsortcolumn = this.dom.listItems.append("div").attr("class","listcell listsortcolumn")
            .style("width",this.sortColWidth+"px")
            .html(function(d){ return me.sortingOpt_Active.label(d); })
            .each(function(d){ this.columnValue = me.sortingOpt_Active.label(d); })
            .each(function(d){
                this.tipsy = new Tipsy(this, {
                    gravity: 's',
                    fade: true,
                    opacity: 1,
                    title: function(){ 
                        // If column filter is added, tipsy is not shown.
                        return "<span class='big'>+</span> <span class='action'>Add</span> <i>"+
                            me.sortingOpt_Active.name+"</i> Filter"; 
                    }
                })
            })
            .on("mouseover",function(){
                if(me.sortFilters[me.sortingOpt_ActiveIndex].isFiltered) return;
                this.tipsy.show();
            })
            .on("mouseout",function(d,i){
                this.tipsy.hide();
            })
            .on("click",function(d,i){
                if(me.sortFilters[me.sortingOpt_ActiveIndex].isFiltered) return;
                this.tipsy.hide();
                // get clicked item's html value and pass it to the filter func
                me.filterSortCol(this.columnValue);
            })
            ;
    },
    /** -- */
    insertSortSelect: function(){
        var me=this;
        if(this.sortingOpts.length<2) {
            this.dom.listHeader.append("div").attr("class","listsortcolumn")
                .style("width",this.sortColWidth+"px")
                .text(this.sortingOpts[0].name);
            return;
        }
        this.dom.listHeader.append("select")
            .attr("class","listSortOptionSelect")
            .style("width",(this.sortColWidth+5)+"px") // 5 pixel is used for padding in the list part.
            .on("change", function(){
                me.sortingOpt_Active = me.sortingOpts[this.selectedIndex];
                me.sortingOpt_ActiveIndex = this.selectedIndex;
                me.sortItems();
                me.reorderItemsOnDOM();
                if(me.displayType==='list'){
                    // update sort column labels
                    me.dom.listsortcolumn
                        .html(function(d){ return me.sortingOpt_Active.label(d); })
                        .each(function(d){ this.columnValue = me.sortingOpt_Active.label(d); });
                }
                me.updateShowListGroupBorder();
            })
            .selectAll("input.list_sort_label")
                .data(this.sortingOpts)
            .enter().append("option")
                .attr("class", "list_sort_label")
                .text(function(d){ return d.name; })
                ;
    },
    /** -- */
    insertItemToggleDetails: function(){
        var kshf_ = this.getKshf();
        var x= this.dom.listItems
            .append("div")
            .attr("class","listcell itemtoggledetails")
            .each(function(d){
                this.tipsy = new Tipsy(this, {
                    gravity:'s', fade:true, className:'details',
                    title: function(){ return "Show details"; }
                });
            })
            ;
        x.append("span").attr("class","item_details_on").html("[+]")
            .on("click", function(d){ 
                this.parentNode.tipsy.hide();
                kshf_.showListItemDetails(d);
            })
            .on("mouseover",function(d){
                this.parentNode.tipsy.options.title = function(){ return "Show details"; };
                this.parentNode.tipsy.show();
            })
            .on("mouseout",function(d){ this.parentNode.tipsy.hide(); })
            ;
        x.append("span").attr("class","item_details_off").html("[-]")
            .on("click", function(d){ 
                kshf_.hideListItemDetails(d);
            })
            .on("mouseover",function(d){ 
                this.parentNode.tipsy.options.title = function(){ return "Hide details"; };
                this.parentNode.tipsy.show();
            })
            .on("mouseout",function(d){ this.parentNode.tipsy.hide(); })
            ;
    },
    /** -- */
    insertItemLinkBar: function(){
        var me=this;
        var x= this.dom.listItems.append("div").attr("class","listcell itemLinks")
            .style("width",this.linkFilterWidth+"px")
            .each(function(d){
                this.tipsy = new Tipsy(this, {
                    gravity:'s', fade:true, className:'details',
                    title: function(){ 
                        return "<span class='big'>+</span> <span class='action'>Add</span> <i>"+
                            me.itemLink+"</i> Filter"; 
                    }
                });
            })
            .on("click",function(item){
                if(item.activeItems===0) return;
                this.tipsy.hide();
                me.filterLinks(item);
            })
            .on("mouseover",function(){
                this.tipsy.show();
            })
            .on("mouseout",function(d,i){
                this.tipsy.hide();
            })
            .append("span").attr("class","captureEvents")
            ;
        this.dom.listItems_itemLinks_captureEvents = x;
        this.dom.listItems_itemLinks_itemCount = x.append("span").attr("class","itemCount");
        this.dom.listItems_itemLinks_itemBar = x.append("span").attr("class","itemBar");
        this.updateItemLinks();
    },
    /** -- */
    insertItemsToggleDetails: function(){
        if(this.detailsToggle==="Off") return;
        var me=this;
        var x=this.dom.listHeader.append("div").attr("class","itemtoggledetails");
        x.append("span").attr("class","items_details_on").html("[+]")
            .attr("title","Show details")
            .on("click", function(d){
                me.dom.listItems.attr('details', true);
                me.listDiv.attr('showAll','false');
            });
        x.append("span").attr("class","items_details_off").html("[-]")
            .attr("title","Hide details")
            .on("click", function(d){
                me.dom.listItems.attr('details', false);
                me.listDiv.attr('showAll','true');
            });
    },
    /** -- */
    insertItemLinkBar_Header: function(){
        this.dom.listHeader.append("div").attr("class","itemLinks")
            .style("width",this.linkFilterWidth+"px")
            .append("span").attr("class","header")
            .html(this.itemLink)
            ;
    },
    /** after you re-sort the primary table or change item visibility, call this function */
    updateShowListGroupBorder: function(){
        var me = this;
        var items = this.getKshfItems();
        if(this.displayType==='list') {
            if(this.sortingOpt_Active.noGroupBorder===true){
                this.dom.listItems.style("border-top-width", "0px");
            } else {
                // go over item list
                var pItem=null;
                var sortValueFunc = this.sortingOpt_Active.value;
                var sortFunc = this.sortingOpt_Active.func;
                items.forEach(function(item,i){
                    if(!item.wanted) return;
                    if(pItem!==null){ 
                        if(item.listItem!==undefined)
                        item.listItem.style.borderTopWidth = 
                            sortFunc(sortValueFunc(item),sortValueFunc(pItem))!==0?"4px":"0px";
                    }
                    pItem = item;
                });
            }
        }
    },
    /** Reorders items in the DOM
     *  Only called after list is re-sorted (not called after filtering)
     */
    reorderItemsOnDOM: function(){
        this.dom.listItems
            .data(this.getKshfItems(), function(d){ return d.id(); })
            .order();
    },
    /** Sort all items fiven the active sort option 
     *  List items are only sorted on list init and when sorting options change.
     *  They are not resorted on filtering! In other words, filtering does not affect item sorting.
     */
    sortItems: function(){
        var me=this;
        var sortValueFunc = this.sortingOpt_Active.value;
        var sortFunc = this.sortingOpt_Active.func;
        var inverse = this.sortingOpt_Active.inverse;
        this.getKshfItems().sort(function(a,b){
            // do not need to process unwanted items, their order does not matter
            if(!a.wanted||!b.wanted){ return 0; }
            var dif=sortFunc(sortValueFunc(a),sortValueFunc(b));
            if(dif===0){ dif=b.id()-a.id(); }
            if(inverse) dif = -dif;
            return dif; // use unique IDs to add sorting order as the last option
        });
    },
    /** Returns the sort value type for fiven sort Value function */
    getSortFunc: function(sortValueFunc){
        // 0: string, 1: date, 2: others
        var sortValueType_, sortValueType_temp, same;
        
        // find appropriate sortvalue type
        for(var k=0, same=0; true ; k++){
            if(same===3 || k===this.getKshfItems().length){
                sortValueType_ = sortValueType_temp;
                break;
            }
            var item = this.parentKshf.items[k];
            var f = sortValueFunc(item);
            var sortValueType_temp2;
            switch(typeof f){
            case 'string': sortValueType_temp2 = kshf.Util.sortFunc_List_String; break;
            case 'number': sortValueType_temp2 = kshf.Util.sortFunc_List_Number; break;
            case 'object': 
                if(f instanceof Date) 
                    sortValueType_temp2 = kshf.Util.sortFunc_List_Date; 
                else 
                    sortValueType_temp2 = kshf.Util.sortFunc_List_Number;
                break;
            default: sortValueType_temp2 = kshf.Util.sortFunc_List_Number; break;
            }

            if(sortValueType_temp2===sortValueType_temp){
                same++;
            } else {
                sortValueType_temp = sortValueType_temp2;
                same=0;
            }
        }
        return sortValueType_;
    },
    /** Updates visibility of list items */
    updateItemVisibility: function(showMoreOnly){
        var me = this;
        var showType=this.displayType==='list'?"block":"inline-block";
        var visibleItemCount=0;

        var isInViewNow = function(item){
            return ;
        };
        var isInViewBefore = function(item){
            return 
        };

        this.dom.listItems
            .each(function(item){
                var domItem = this;
                // adjust visibleItemCount
                var isVisible = (item.wantedOrder>=0 && item.wantedOrder<me.maxVisibleItems);
                if(isVisible) visibleItemCount++;

                if(showMoreOnly){
                    this.style.display = isVisible?showType:'none';
                    this.setAttribute("animSt","visible");
                    return;
                }

                var isInViewNow = item.wantedOrder>=0 && item.wantedOrder<50;
                var isInViewBefore = item.wantedOrder_pre>=0 && item.wantedOrder_pre<50;

                // NOTE: Max 100 items can be under animation (in view now, or before), so don't worry about performance!

                if(isInViewNow){
                    if(isInViewBefore){
                        // "in view" now, "in view" before
                        this.setAttribute("animSt","visible");
                        this.style.display = isVisible?showType:'none';
                    } else {
                        this.style.display = showType;
                        domItem.setAttribute("animSt","closed"); // start from closed state
                        // "in view" now, but not "in view" before
                        setTimeout(function(){ domItem.setAttribute("animSt","open") },500);
                        setTimeout(function(){ domItem.setAttribute("animSt","visible") },1100+item.wantedOrder*10);
                    }
                } else {
                    // item not in view now
                    if(isInViewBefore && isVisible===false){
                        // not in view now, but in view before
                        setTimeout(function(){ domItem.setAttribute("animSt","open") },-item.wantedOrder*10);
                        setTimeout(function(){ domItem.setAttribute("animSt","closed") },500);
                        setTimeout(function(){ domItem.style.display = 'none' },1000);
                    } else {
                        // not "in view" now or before
                        this.setAttribute("animSt","visible");
                        this.style.display = isVisible?showType:'none';
                    }
                }
            });

        var hiddenItemCount = this.getKshf().itemsSelectedCt-visibleItemCount;
        this.dom.showMore.style("display",
            (hiddenItemCount===0)?"none":"block");
        this.dom.showMore.select(".CountAbove").html("&#x25B2;"+visibleItemCount+" shown");
        this.dom.showMore.select(".CountBelow").html(hiddenItemCount+" below&#x25BC;");
    },
    /** -- */
    updateContentWidth: function(contentWidth){
        if(this.detailsToggle!=="Off") contentWidth-=this.itemtoggledetailsWidth;
        contentWidth-=this.sortColWidth;
        if(this.itemLink!==undefined) contentWidth-=this.linkFilterWidth;
        contentWidth-=12; // works for now. TODO: check 
//        this.dom.filtercrumbs.style("width",(contentWidth-150)+"px");
        if(this.displayType==='list'){
            this.dom.listItems_Content.style("width",(contentWidth-10)+"px");
        }
        this.contentWidth = contentWidth;
    },
    /** -- */
    updateTotalWidth: function(totalWidth){
        this.totalWidth = totalWidth;
        this.dom.showMore.style("width",(totalWidth-30)+"px");
    },
    /** -- */
    updateItemLinks: function(){
        var me = this;
        var kshf_ = this.getKshf();
        this.linkBarAxisScale = d3.scale.linear()
            .domain([0,this.getMaxBarValuePerItem()])
            .rangeRound([0, this.itemBarWidth_Max]);
        this.dom.listItems_itemLinks_captureEvents
            .attr("count",function(d){ return d.activeItems; });
        this.dom.listItems_itemLinks_itemCount
            .text(function(d){ return d.activeItems; });
        this.dom.listItems_itemLinks_itemBar
            .transition().duration(kshf_.anim_layout_duration)
            .style("width", function(d){ return me.linkBarAxisScale(d.activeItems)+"px"; })
    },
    /** returns the maximum number of items stored per row in chart data */
    getMaxBarValuePerItem: function(){
        var dataMapFunc = this.itemLinkFunc;
        return d3.max(this.getKshfItems(), function(d){ 
            if(dataMapFunc(d)===null) { return null; }
            return d.activeItems;
        });
    },
    updateAfterFiltering_do:function(){
        this.updateVisibleIndex();
        this.maxVisibleItems = kshf.maxVisibleItems_default;
        this.updateItemVisibility(false);
        // this.updateShowListGroupBorder();
        if(this.itemLink!==undefined){
//            this.updateItemLinks();
        }
    },
    /** returns active filter count */
    updateAfterFiltering: function(){
        var me=this;
        // scroll to top
        var startTime = null;
        var scrollDom = this.dom.listItemGroup[0][0];
        var scrollInit = scrollDom.scrollTop;
        var easeFunc = d3.ease('cubic-in-out');
        var scrollTime = 1000;
        var animateToTop = function(timestamp){
            var progress;
            if(startTime===null) startTime = timestamp;
            // complete animation in 500 ms
            progress = (timestamp - startTime)/scrollTime;
            scrollDom.scrollTop = (1-easeFunc(progress))*scrollInit;
            if(scrollDom.scrollTop===0){
                me.updateAfterFiltering_do();
            } else {
                window.requestAnimationFrame(animateToTop);
            }
        };
        window.requestAnimationFrame(animateToTop);
    },
    updateVisibleIndex: function(){
        var wantedCount = 0;
        var unwantedCount = 1;
        this.getKshfItems().forEach(function(item){
            item.wantedOrder_pre = item.wantedOrder;
            if(item.wanted){
                item.wantedOrder = wantedCount;
                wantedCount++;
            } else {
                item.wantedOrder = -unwantedCount;
                unwantedCount++;
            }
        },this);
    },
    isFiltered_Link: function(){
        return this.filteringItem!==null;
    },
    filterLinks: function(item_src){
        if(item_src.f_included()){
            item_src.f_unselect();
        } else {
            item_src.f_include();
        }
        var filterId = this.linkFilter.id;

        // unselect previous one if selected
        if(this.filteringItem) this.filteringItem.f_unselect();
        this.filteringItem = item_src;

        // if any of the linked items are selected, filtering will pass true
        this.getKshfItems().forEach(function(item){
            var m = item.mappedData[filterId];
            var f = false;
            if(m!==undefined && m!==null & m!==""){ 
                if(m instanceof Array){
                    f = kshf.Util.filter_multi_or.call(this,m);
                } else {
                    f = m.included();
                }
            }
            item.setFilter(filterId,f);
            item.updateSelected();
        });

        this.linkFilter.addFilter(true);
    },
    filterSortCol: function(clickedText){
        // what is current sorting column?
        var labelFunc=this.sortingOpt_Active.label;
        var sortFilter = this.sortFilters[this.sortingOpt_ActiveIndex];
        var filterId = sortFilter.id;

        // if any of the linked items are selected, filtering will pass true
        // Note: items can only have one mapping (no list stuff here...)
        this.getKshfItems().forEach(function(item){
            item.setFilter(filterId,(labelFunc(item)===clickedText));
            item.updateSelected();
        });

        sortFilter.value = clickedText;
        sortFilter.addFilter(true);
    },
    clearFilter_Links: function(){
        if(this.filteringItem===null) return;
        this.filteringItem.f_unselect();
        this.filteringItem = null;
        this.linkFilter.clearFilter(true);
    },
    clearFilter_Sort: function(){
        // TODO
    },
    textItemFunc: function(){
        return "<b>"+this.itemLinkText(this.filteringItem)+"</b>";
    },
    textItemFunc_Sort: function(filter){
        return "<b>"+filter.value+"</b>";
    }
};

/**
 * @constructor
 */
kshf.Browser = function(options){
    var me = this;
    // BASIC OPTIONS
	this.charts = [];
    this.maxFilterID = 0;
    this.barMaxWidth = 0;

    this.scrollPadding = 5;
    this.scrollWidth = 20;
    this.sepWidth = 10;
    this.filterList = [];

    this.anim_barscale_duration_default = 400;
    
    this.anim_layout_duration = 700;
    this.anim_layout_delay = 300;
    
    this.categoryTextWidth = options.categoryTextWidth;
    if(this.categoryTextWidth===undefined){
        this.categoryTextWidth = 115;
    }
    if(typeof options.barChartWidth === 'number'){
        this.barChartWidth = options.barChartWidth;
    }

    this.subBrowser = options.subBrowser;

/*    if(this.categoryTextWidth<115){
        this.categoryTextWidth = 115;
    }*/
    this.chartDefs = options.charts;
    this.listDef = options.list;
    this.hideHeaderButtons = options.hideHeaderButtons;
    if(this.hideHeaderButtons===undefined){
        this.hideHeaderButtons = false;
    }

    this.primItemCatValue = null;
    if(typeof options.catValue === 'string'){
        this.primItemCatValue = options.catValue;
    }

    if(options.listMaxColWidthMult){
        this.listMaxColWidthMult = options.listMaxColWidthMult;
    } else {
        this.listMaxColWidthMult = 0.25;
    }
    this.line_height=options.line_height;
    if(this.line_height===undefined){
        this.line_height = 18; // default
    }

    this.domID = options.domID;
    this.source = options.source;
    this.source.loadedTableCount=0;
    this.loadedCb = options.loadedCb;
    this.readyCb = options.readyCb;
    this.updateCb = options.updateCb;
    this.dom = {}

    this.anim_barscale_duration = this.anim_barscale_duration_default;

    this.skipFacet = {};
    if(options.columnsSkip){
        options.columnsSkip.forEach(function(c){
            this.skipFacet[c] = true;
        },this);
    }

    // itemName
    if(options.itemName!==undefined){
        this.itemName = options.itemName;
    } else {
        this.itemName = this.source.sheets[0].name;
    }
    // dirRoot 
    this.dirRoot = options.dirRoot;
    if(this.dirRoot === undefined){
        this.dirRoot = "./";
    }
    // showDataSource
    this.showDataSource = true;
    if(options.showDataSource!==undefined){
        this.showDataSource = options.showDataSource;
    }
    // forceHideBarAxis
    this.forceHideBarAxis = false;
    if(options.forceHideBarAxis!==undefined){
        this.forceHideBarAxis = options.forceHideBarAxis;
    }

    this.TopRoot = d3.select(this.domID)
        .classed("kshfHost",true)
        .attr("tabindex","1")
        .style("position","relative")
//        .style("overflow-y","hidden")
        .on("keydown",function(){
            var e = d3.event;
            if(e.keyCode===27){
                me.clearFilters_All();
                if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.ClearAllEscape,this.getFilteringState());
            }
        })
        ;

    // remove any DOM elements under this domID, kshf takes complete control over what's inside
    var rootDomNode = this.TopRoot[0][0];
    while (rootDomNode.hasChildNodes()) rootDomNode.removeChild(rootDomNode.lastChild);

    // insert gradient defs once into the document
    kshf.num_of_browsers++;
    if(kshf.num_of_browsers==1) this.insertGradients();
    this.TopRoot.append("div").attr("class","subBrowsers");

    this.root = this.TopRoot.append("div").attr("noanim",false);

    if(options.showResizeCorner === true){
        this.insertResize();
    }

    this.insertInfobox();

    this.insertBrowserHeader();

    this.dom.subRoot = this.root.append("div").attr("class","subRoot");

    this.layoutBackground = this.dom.subRoot.append("div").attr("class","kshf layout_left_background");

    this.dom.leftBlockAdjustSize = this.layoutBackground.append("div").style("position","relative")
        .append("span").attr("class","leftBlockAdjustSize")
        .attr("title","Drag to adjust panel width")
        .style("height",(this.line_height-4)+"px")
        .on("mousedown", function (d, i) {
            me.root.style('cursor','ew-resize');
            me.root.attr('noanim',true);
            var mouseDown_x = d3.mouse(this.parentNode.parentNode)[0];
            var mouseDown_width = me.width_leftPanel_bar;
            me.root.on("mousemove", function() {
                var mouseMove_x = d3.mouse(this)[0];
                var mouseDif = mouseMove_x-mouseDown_x;
                me.anim_barscale_duration = 0;
                me.anim_layout_duration = 0;
                me.setBarWidthLeftPanel(mouseDown_width+mouseDif);
                me.updateLayout();
                me.anim_layout_duration = 700;
            }).on("mouseup", function(){
                me.root.style('cursor','default');
                me.root.attr('noanim',false);
                // unregister mouse-move callbacks
                me.root.on("mousemove", null).on("mouseup", null);
                if(sendLog) sendLog(CATID.Other,ACTID_OTHER.LeftPanelWidth,{panelWidth:me.width_leftPanel_bar});
            });
            d3.event.preventDefault();
        })
        .on("click",function(){
            d3.event.stopPropagation();
            d3.event.preventDefault();
        });    

    this.layoutTop = this.dom.subRoot.append("div").attr("class", "kshf layout_top");
    this.layoutLeft  = this.dom.subRoot.append("div").attr("class", "kshf layout_left");
	
    this.loadSource();
};

kshf.Browser.prototype = {
    // TODO: Not used yet. If names are the same and config options are different, what do you do?
    createFilter: function(opts){
        // see if it has been created before TODO
        var newFilter = new kshf.Filter(opts);
        this.filterList.push(newFilter);
        return newFilter;
    },
    insertResize: function(){
        var me=this;
        this.root.append("div").attr("class", "kshf layout_resize")
            .on("mousedown", function (d, i) {
                me.root.style('cursor','nwse-resize');
                var mouseDown_x = d3.mouse(d3.select("body")[0][0])[0];
                var mouseDown_y = d3.mouse(d3.select("body")[0][0])[1];
                var mouseDown_width  = parseInt(d3.select(this.parentNode).style("width"));
                var mouseDown_height = parseInt(d3.select(this.parentNode).style("height"));
                d3.select("body").on("mousemove", function() {
                    var mouseDown_x_diff = d3.mouse(d3.select("body")[0][0])[0]-mouseDown_x;
                    var mouseDown_y_diff = d3.mouse(d3.select("body")[0][0])[1]-mouseDown_y;
                    d3.select(me.domID).style("height",(mouseDown_height+mouseDown_y_diff)+"px");
                    d3.select(me.domID).style("width" ,(mouseDown_width +mouseDown_x_diff)+"px");
                    me.updateLayout();
                }).on("mouseup", function(){
                    if(sendLog) sendLog(CATID.Other,ACTID_OTHER.Resize);
                    me.root.style('cursor','default');
                    // unregister mouse-move callbacks
                    d3.select("body").on("mousemove", null).on("mouseup", null);
                });
               d3.event.preventDefault();
           });
    },
    insertGradients: function(){
        // add gradients
        var rowBackgroundColor = "#dadada";
        var otherGradientColor="gray";
        var gradient_svg = this.TopRoot.append("svg").attr("width",0).attr("height",0)
            .style("display","block").append("defs");
        var dotBackgroundColor = "#616F7A";
        var dotBackgroundColor_Inactive = "#CCCCCC";

        gradient_svg.append("symbol").attr("id","kshf_svg_search")
            .attr("viewbox","0 0 491.237793 452.9882813")
            .html(
              '<g fill-rule="nonzero" clip-rule="nonzero" fill="#0F238C" stroke="#cb5454" stroke-miterlimit="4">'+
               '<g fill-rule="evenodd" clip-rule="evenodd">'+
                '<path fill="#cb5454" id="path3472" d="m328.087402,256.780273c-5.591797,8.171875 -13.280273,17.080078 -22.191406,25.296875c-9.685547,8.931641 -20.244141,16.550781 -27.433594,20.463867l163.125977,150.447266l49.649414,-45.783203l-163.150391,-150.424805z"/>'+
                '<path fill="#cb5454" id="path3474" d="m283.82959,45.058109c-65.175781,-60.07764 -169.791023,-60.07764 -234.966309,0c-65.150881,60.100582 -65.150881,156.570309 0,216.671383c65.175285,60.100586 169.790527,60.100586 234.966309,0c65.175781,-60.101074 65.175781,-156.570801 0,-216.671383zm-34.198242,31.535152c-46.204102,-42.606934 -120.390625,-42.606934 -166.570305,0c-46.204594,42.583496 -46.204594,110.994141 0,153.601074c46.17968,42.606445 120.366203,42.606445 166.570305,0c46.205078,-42.606934 46.205078,-111.017578 0,-153.601074z"/>'+
               '</g>'+
              '</g>');

        gradient_svg.append("symbol").attr("id","kshf_svg_clearText")
            .attr("viewbox","0 0 48 48")
            .html(
                '<g>'+
                    '<path type="arc" style="fill-opacity:1;" cx="24" cy="24" rx="22" ry="22" d="M 46 24 A 22 22 0 1 1  2,24 A 22 22 0 1 1  46 24 z"/>'+
                    '<path nodetypes="cc" style="fill:none;fill-opacity:0.75;fill-rule:evenodd;stroke:#ffffff;stroke-width:6;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1" d="M 16.221825,16.221825 L 31.778175,31.778175"/>'+
                    '<path nodetypes="cc" d="M 31.778175,16.221825 L 16.221825,31.778175" style="fill:none;fill-opacity:0.75;fill-rule:evenodd;stroke:#ffffff;stroke-width:6;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"/>'+
                '</g>'
                );

        var gradient;

        gradient =gradient_svg.append("radialGradient")
            .attr("id","dotGradient_Inactive")
            .attr("x1","0%")
            .attr("y1","0%")
            .attr("x2","0%")
            .attr("y2","100%");
        gradient.append("stop")
            .attr("offset","0%")
            .style("stop-color",dotBackgroundColor_Inactive)
            .style("stop-opacity",1);
        gradient.append("stop")
            .attr("offset","25%")
            .style("stop-color",dotBackgroundColor_Inactive)
            .style("stop-opacity",1);
        gradient.append("stop")
            .attr("offset","100%")
            .style("stop-color",dotBackgroundColor_Inactive)
            .style("stop-opacity",0);
    },
    /* -- */
    insertInfobox: function(){
        var me=this;
        var creditString="";
        creditString += "<div align='center'>";
        creditString += "<div class='header'>Browser created by <span class='libName'>Keshif</span> library</div>";
        creditString += "<div align='center' class='boxinbox project_credits'>";
        creditString += " Developed by:<br/>";
            creditString += "<div style='float:right;'>"
            creditString += "<iframe src='http://ghbtns.com/github-btn.html?user=adilyalcin&repo=Keshif&type=watch&count=true' allowtransparency='true' frameborder='0' scrolling='0' width='90px' height='20px'></iframe><br/>";
            creditString += "<iframe src='http://ghbtns.com/github-btn.html?user=adilyalcin&repo=Keshif&type=fork&count=true' allowtransparency='true' frameborder='0' scrolling='0' width='90px' height='20px'></iframe>";
            creditString += "</div>";
        creditString += " <a href='http://www.adilyalcin.me' target='_blank'><img src='"+this.dirRoot+"img/credit-1_01.png' style='height:50px'></a>";
        creditString += " <img src='"+this.dirRoot+"img/credit-1_02.png' style='height:50px; padding:0px 4px 0px 4px'>";
        creditString += " <a href='http://www.cs.umd.edu/hcil/' target='_blank'><img src='"+this.dirRoot+"img/credit-1_03.png' style='height:50px'></a>";
        creditString += " <img src='"+this.dirRoot+"img/credit-1_04.png' style='height:50px;padding:0px 4px 0px 4px'>";
        creditString += " <a href='http://www.umd.edu' target='_blank'><img src='"+this.dirRoot+"img/credit-1_05.png' style='height:50px'></a>";
        creditString += "</div>";
        creditString += "";
        creditString += "<div align='center' class='boxinbox project_credits'>";
        creditString += " 3rd party libraries and APIs used:<br/>";
        creditString += " <a href='http://d3js.org/' target='_blank'>D3</a> -";
        creditString += " <a href='http://jquery.com' target='_blank'>JQuery</a> -";
        creditString += " <a href='https://developers.google.com/chart/' target='_blank'>Google Charts</a>";
        creditString += "</div><br/>";
        creditString += "";
        creditString += "<div align='center' class='project_fund'>";
        creditString += "Keshif (<a target='_blank' href='http://translate.google.com/#auto/en/ke%C5%9Fif'><i>keşif</i></a>) means discovery / exploration in Turkish.<br/>";
        creditString += "Funded in part by <a href='http://www.huawei.com'>Huawei</a>. </div>";
        creditString += "";

        this.layout_infobox = this.root.append("div").attr("class", "kshf layout_infobox");
        this.layout_infobox.append("div")
            .attr("class","infobox_background")
            .on("click",function(){
                me.layout_infobox.style("display","none");
                me.layout_infobox.select("div.infobox_credit").style("display","none");
                me.layout_infobox.select("div.infobox_datasource").style("display","none");
            });
        this.dom.loadingBox = this.layout_infobox.append("div").attr("class","infobox_content infobox_loading");
        this.dom.loadingBox.append("img").attr("class","status")
            .attr("src",this.dirRoot+"img/loading.gif")
            ;
        var hmmm=this.dom.loadingBox.append("div").attr("class","status_text");
        hmmm.append("span").text("Loading...");
        hmmm.append("div")
            .text(
                (this.source.sheets!==undefined)?
                "("+this.source.loadedTableCount+"/"+this.source.sheets.length+")":
                ""
                );

        var infobox_credit = this.layout_infobox.append("div").attr("class","infobox_content infobox_credit")
        infobox_credit.append("div").attr("class","infobox_close_button").text("x")
            .on("click",function(){
                me.layout_infobox.style("display","none");
                me.layout_infobox.select("div.infobox_credit").style("display","none");
                me.layout_infobox.select("div.infobox_datasource").style("display","none");
            });
        infobox_credit.append("div").attr("class","all-the-credits").html(creditString);

        var infobox_datasource = this.layout_infobox.append("div").attr("class","infobox_content infobox_datasource").text("Datasource files:");
        infobox_datasource.append("div").attr("class","infobox_close_button").text("x")
            .on("click",function(){
                me.layout_infobox.style("display","none");
                me.layout_infobox.select("div.infobox_credit").style("display","none");
                me.layout_infobox.select("div.infobox_datasource").style("display","none");
            });
        var infobox_datasource_ul = infobox_datasource.append("ul");
        if(this.showDataSource && this.source.gDocId===undefined && this.source.callback===undefined){
            infobox_datasource_ul.selectAll("li")
                .data(this.source.sheets, this._dataMap)
              .enter().append("li")
                .append("a")
                .attr("target","_blank")
                .attr("href",function(i){ return me.source.dirPath+i.name+"."+me.source.fileType;})
                .text(function(i){ return i.name+"."+me.source.fileType;})
                ;
        }
    },
    /** --- */
    insertClearAll: function(){
        var me=this;
        // insert clear all option
        if(this.listDisplay===undefined) {
            this.dom.filterClearAll = this.root.select(".ffffffff");
            return;
        }
        this.dom.filterClearAll = this.listDisplay.dom.listHeader.append("span").attr("class","filterClearAll").text("Show all");
        this.dom.filterClearAll.append("div").attr("class","chartClearFilterButton allFilter")
            .text("x")
            .on("click",function(){ 
                this.tipsy.hide();
                me.clearFilters_All();
            })
            .each(function(d){
                this.tipsy = new Tipsy(this, {
                    gravity: 'n',
                    fade: true,
                    opacity: 1,
                    title: function(){ 
                        return "<span class='big'>x</span class='big'> <span class='action'>Remove</span> all filtering"; 
                    }
                })
            })
            .on("mouseover",function(){
                this.tipsy.show();
            })
            .on("mouseout",function(d,i){
                this.tipsy.hide();
                d3.event.stopPropagation();
            })
            ;
    },
    /** --- */
    insertBrowserHeader: function(){
        var me = this;
        this.layoutHeader = this.root.append("div").attr("class", "kshf layout_header");

        if(this.hideHeaderButtons===false){
            var rightSpan = this.layoutHeader.append("span").attr("class","rightBoxes");

            // Info & Credits
            rightSpan.append("div").attr("class","credits")
                .text("i").attr("title","Show Info & Credits")
                .on("click",function(){ me.showInfoBox();})
                ;

            // TODO: implement popup for file-based resources
            if(this.showDataSource !== false){
                rightSpan.append("div")
                    .style("float","right")
                    .style("margin","2px")
                    .on("click",function(){
                        if(me.source.gdocId){
                            window.open("https://docs.google.com/spreadsheet/ccc?key="+me.source.gdocId,"_blank");
                        } else {
                            me.layout_infobox.style("display","block");
                            me.layout_infobox.style("display","block");
                        }
                        if(sendLog) sendLog(CATID.Other,ACTID_OTHER.DataSource);
                    })
                  .append("img").attr("class","datasource")
                    .attr("title","Open Data Source")
                    .attr("src",this.dirRoot+"img/datasource.png")
                    ;
                }
            }

        var resultInfo = this.layoutHeader.append("span").attr("class","resultInfo");

        this.dom.listheader_count = resultInfo.append("span").attr("class","listheader_count");
        resultInfo.append("span").attr("class","listheader_itemName").html(this.itemName);

        this.dom.filtercrumbs = this.layoutHeader.append("span").attr("class","filtercrumbs");
    },
    showInfoBox: function(){
        if(sendLog) sendLog(CATID.Other,ACTID_OTHER.InfoButton);
        this.layout_infobox.style("display","block");
        this.layout_infobox.select(".infobox_credit").style("display","block");
    },
    loadSource: function(){
        if(this.source.callback){
            this.source.callback(this);
            return;
        }
        this.source.sheets[0].primary = true;
        this.primaryTableName = this.source.sheets[0].name;
        this.source.sheets.forEach(function(sheet){
            if(sheet.id===undefined) sheet.id="id"; // set id column
            if(sheet.tableName===undefined) sheet.tableName = sheet.name; // set table name
            // if this table name has been loaded, skip this one
            if(kshf.dt[sheet.tableName]!==undefined){
                this.incrementLoadedSheetCount();
                return;
            }
            if(this.source.gdocId){
                this.loadSheet_Google(sheet);
            } else if(this.source.dirPath){
                this.loadSheet_File(sheet);
            } else if (sheet.data) { // load data from memory - ATR
                this.loadSheet_Memory(sheet);
            }
        },this);
    },
    loadSheet_Google: function(sheet){
        var me=this;
        var qString=kshf.queryURL_base+this.source.gdocId+'&headers=1'
        if(sheet.sheetID){
            qString+='&gid='+sheet.sheetID;
        } else {
            qString+='&sheet='+sheet.name;
        }
        if(sheet.range){
            qString+="&range="+sheet.range;
        }

        var googleQuery=new google.visualization.Query(qString);
        if(sheet.query) googleQuery.setQuery(sheet.query);

        googleQuery.send( function(response){
            if(kshf.dt[sheet.tableName]!==undefined){
                me.incrementLoadedSheetCount();
                return;
            }
            if(response.isError()) {
                me.layout_infobox.select("div.status_text span")
                    .text("Cannot load data");
                me.layout_infobox.select("img")
                    .attr("src",me.dirRoot+"img/alert.png")
                    .style("height","40px");
                me.layout_infobox.select("div.status_text div")
                    .text("("+response.getMessage()+")");
                return;
            }

            var j,r,i,arr=[],idIndex=-1,itemId=0;
            var dataTable = response.getDataTable();
            var numCols = dataTable.getNumberOfColumns();

            // find the index with sheet.id (idIndex)
            for(i=0; true ; i++){
                if(i===numCols || dataTable.getColumnLabel(i).trim()===sheet.id) {
                    idIndex = i;
                    break;
                }
            }

            // create the item array
            arr.length = dataTable.getNumberOfRows(); // pre-allocate for speed
            for(r=0; r<dataTable.getNumberOfRows() ; r++){
                var c=[];
                c.length = numCols; // pre-allocate for speed
                for(i=0; i<numCols ; i++) { c[i] = dataTable.getValue(r,i); }
                // push unique id as the last column if necessary
                if(idIndex===numCols) c.push(itemId++);
                arr[r] = new kshf.Item(c,idIndex,sheet.primary);
                arr[r].browser = me;
            }

            kshf.createColumnNames(sheet.tableName);
            for(j=0; j<dataTable.getNumberOfColumns(); j++){
                kshf.insertColumnName(sheet.tableName,dataTable.getColumnLabel(j).trim(),j);
            }
            me.finishDataLoad(sheet,arr);
        });
    },
    /** The only place where jquery ajax load is used! */
    loadSheet_File: function(sheet){
        var me=this;
        var fileName=this.source.dirPath+sheet.name+"."+this.source.fileType;
        $.ajax( {
            url:fileName,
            type:"GET",
            contentType:"text/csv",
            success: function(data) {
                if(kshf.dt[sheet.tableName]!==undefined){
                    me.incrementLoadedSheetCount();
                    return;
                }
                var i,j;
                var lines = data.split(/\r\n|\r|\n/g);
                if(lines.length<2) { return; } // csv file doens't have data
                kshf.createColumnNames(sheet.tableName);
                var arr = [];
                var idIndex = -1;
                var itemId=0;
                // for each line, split on , character
                for(i=0; i<lines.length; i++){
                    var c;
                    if(me.source.fileType==='csv')
                        c=lines[i].split(",");
                    else if(me.source.fileType==='tsv')
                        c=lines[i].split("\t");
                    c=kshf.Util.unescapeCommas(c);
                    if(i===0){ // header 
                        for(j=0; j<c.length;j++){
                            var colName = c[j];
                            kshf.insertColumnName(sheet.tableName,colName,j);
                            if(colName===sheet.id){ idIndex = j;}
                        }
                        if(idIndex===-1){ // id column not found, you need to create your own
                            kshf.insertColumnName(sheet.tableName,sheet.id,j);
                            idIndex = j;
                        }
                    } else { // content
                        // push unique id as the last column if necessary
                        if(idIndex===c.length) c.push(itemId++);
                        var item=new kshf.Item(c,idIndex,sheet.primary)
                        item.browser = me;
                        arr.push(item);
                    }
                }
                me.finishDataLoad(sheet, arr);
            }
        });
    },
    /** load data from memory - ATR - Anne Rose */
    loadSheet_Memory: function(sheet){
        var j;
        var arr = [];
        var idIndex = -1;
        var itemId=0;
        if(kshf.dt[sheet.tableName]!==undefined){
            this.incrementLoadedSheetCount();
            return;
        }
        this.createColumnNames(sheet.tableName);
        sheet.data.forEach(function(c,i){
            if(i===0){ // header 
                c.forEach(function(colName,j){
                    kshf.insertColumnName(sheet.tableName,colName,j);
                    if(colName===sheet.id){ idIndex = j;}
                });
                if(idIndex===-1){ // id column not found, you need to create your own
                    kshf.insertColumnName(sheet.tableName,sheet.id,j);
                    idIndex = j;
                }
            } else { // content
                // push unique id as the last column if necessary
                if(idIndex===c.length) c.push(itemId++);
                arr.push(new kshf.Item(c,idIndex,sheet.primary));
            }
        });
        this.finishDataLoad(sheet,arr);
    },
    /** -- */
    createTableFromTable: function(srcData, dstTableName, mapFunc, labelFunc){
        var i,uniqueID=0;
        var me=this;
        kshf.dt_id[dstTableName] = {};
        kshf.dt[dstTableName] = [];
        var dstTable_Id = kshf.dt_id[dstTableName];
        var dstTable = kshf.dt[dstTableName];

        srcData.forEach(function(srcData_i){
            var v = mapFunc(srcData_i);
            if(v==="" || v===undefined || v===null) return;
            if(v instanceof Array) {
                v.forEach(function(v2){
                    if(v2==="" || v2===undefined || v2===null) return;
                    if(!dstTable_Id[v2]){
                        var itemData = [uniqueID++,v2];
                        if(labelFunc){
                            itemData.push(labelFunc(v2));
                        }
                        var item = new kshf.Item(itemData,0);
                        item.browser = me;
                        dstTable_Id[v2] = item;
                        dstTable.push(item);
                    }   
                });
            } else {
                if(!dstTable_Id[v]){
                    var itemData = [uniqueID++,v];
                    if(labelFunc){
                        itemData.push(labelFunc(v2));
                    }
                    var item = new kshf.Item(itemData,0);
                    item.browser = me;
                    dstTable_Id[v] = item;
                    dstTable.push(item);
                }   
            }
        });
    },
    /** -- */
    finishDataLoad: function(sheet,arr) {
        kshf.dt[sheet.tableName] = arr;
        var id_table = {};
        arr.forEach(function(r){id_table[r.id()] = r;});
        kshf.dt_id[sheet.tableName] = id_table;
        this.incrementLoadedSheetCount();
    },
    /** -- */
    incrementLoadedSheetCount: function(){
        var me=this;
        this.source.loadedTableCount++;
        this.layout_infobox.select("div.status_text div")
            .text("("+this.source.loadedTableCount+"/"+this.source.sheets.length+")");
            // finish loading
        if(this.source.loadedTableCount===this.source.sheets.length) {
            this.source.sheets.forEach(function(sheet){
                if(sheet.primary){
                    this.items = kshf.dt[sheet.tableName];
                    this.itemsSelectedCt = this.items.length;
                }
            },this);

            // update primary item stuff if necessary
            if(typeof this.primItemCatValue =='string'){
                var barCountFunc = columnAccessFunc(this.primItemCatValue);
                kshf.dt[this.primaryTableName].forEach(function(d){
                    d.barCount=barCountFunc(d);
                });
            }

            this.layout_infobox.select("div.status_text span")
                .text("Creating Keshif browser");
            this.layout_infobox.select("div.status_text div")
                .text("");
            window.setTimeout(function(){ me.loadCharts(); }, 50);
        }
    },
    /** -- */
    loadCharts: function(){
        var me=this;
        if(this.loadedCb!==undefined) this.loadedCb.call(this);

        if(this.chartDefs===undefined){
            this.chartDefs = [];
            var colNames = kshf.dt_ColNames_Arr[this.primaryTableName];
            colNames.forEach(function(colName){
                if(colName===this.source.sheets[0].id) return;
                if(this.skipFacet[colName]===true) return;
                if(colName[0]==="*") return;
                this.chartDefs.push({facetTitle: colName});
            },this);
        }
        // TODO: Find the first column that has a date value, set it the time component of first chart
        this.chartDefs.forEach(function(param){ me.addBarChart(param); })
        this.charts.forEach(function(chart){ chart.init_DOM(); });
        if(this.listDef!==undefined){
            this.listDisplay = new kshf.List(this,this.listDef,
                this.dom.subRoot.append("div").attr("class", "kshf listDiv")
                );
        }
        this.insertClearAll();

        this.loaded = true;
        this.updateLayout();
        this.update();

        // hide infobox
        this.layout_infobox.style("display","none");
        this.dom.loadingBox.style("display","none");

        if(this.readyCb!==undefined) this.readyCb(this);
    },
    /** -- */
    addBarChart: function(options){
        options.layout = (options.timeTitle!==undefined)?this.layoutTop:this.layoutLeft;
        if(options.catTableName===undefined){
            options.catTableName = this.primaryTableName;
            options.generateRows = true;
        }
        if(options.sortingOpts===undefined) options.sortingOpts = [{}];
        options.rowTextWidth = this.categoryTextWidth;
        this.charts.push(new kshf.BarChart(this,options));
    },
    /** -- */
    columnAccessFunc: function(column){
        // If dt_ColNames is defined for primaryTable, run through mapping
        if(kshf.dt_ColNames[this.primaryTableName]!==undefined)
            column = kshf.dt_ColNames[this.primaryTableName][column];
        return function(d){ return d.data[column]; }
    },

    /** For each primary item
     *  - Run the mapFunc
     *  - If result is array, remove duplicates
     *  - Store result in mappedData[filterId]
     *  - For each result, add the primary item under that item.
     */
    mapItemData: function(mapFunc, targetTable, filterId){
        this.items.forEach(function(item){
            var toMap = mapFunc(item);
            if(toMap===undefined || toMap==="" || toMap===null) { 
                toMap=null;
                item.mappedData[filterId] = null;
                return;
            } else if(toMap instanceof Array){
                // remove duplicate values in the array
                var found = {};
                toMap = toMap.filter(function(e){
                    if(found[e]===undefined){
                        found[e] = true;
                        return true;
                    }
                    return false;
                });
                if(toMap.length===1) {
                    toMap = toMap[0]; // array to single item
                } else {
                    item.mappedData[filterId] = [];
                    toMap.forEach(function(a){
                        var m=targetTable[a];
                        if(m==undefined) return;
                        item.mappedData[filterId].push(m);
                        m.addItem(item);
                    });
                    return;
                }
            }
            var m=targetTable[toMap];
            if(m==undefined) return;
            item.mappedData[filterId] = m;
            m.addItem(item);
        });
    },
    /** set x offset to display active number of items */
    getRowLabelOffset: function(){
        if(this._labelXOffset) return this._labelXOffset
        var maxTotalCount = d3.max(this.charts, function(chart){ 
            return chart.getMaxBarValueMaxPerAttrib();
        });
        this._labelXOffset = 9;
        var digits = 1;
        while(maxTotalCount>9){
            digits++;
            maxTotalCount = Math.floor(maxTotalCount/10);
        }
        if(digits>4) digits = 4;
        this._labelXOffset += digits*6;
        return this._labelXOffset;
    },
    /** includes label + number */
    getRowTotalTextWidth: function(){
        return this.categoryTextWidth + this.getRowLabelOffset();
    },
    getWidth_LeftPanel: function(){
        return this.getRowTotalTextWidth()+this.width_leftPanel_bar+this.scrollWidth;
    },
    /** -- */
    domHeight: function(){
        return parseInt(this.TopRoot.style("height"));
    },
    /** -- */
    domWidth: function(){
        return parseInt(this.TopRoot.style("width"));
    },
    /** -- */
    filterFacetAttribute: function(chartId, itemId){
        var chart = this.charts[chartId];
        chart.filterAttrib(chart.getAttribs()[itemId]);
    },
    /** -- */
    clearFilters_All: function(force){
        // clear all registered filters
        this.filterList.forEach(function(filter){ filter.clearFilter(false); })
        if(force!==false){
            this.items.forEach(function(item){ item.updateSelected_SelectOnly(); });
            this.update();
        }
    },
    /** -- */
    update: function () {
        var me=this;

        // if running for the first time, do stuff
        if(this.firsttimeupdate === undefined){
            this.items.forEach(function(item){item.updateSelected();});
            this.firsttimeupdate = true; 
        }

        this.anim_barscale_duration = this.anim_barscale_duration_default;

        if(this.listDisplay){
            this.listDisplay.updateAfterFiltering();
        }

        this.dom.listheader_count.text(function(){
            return (me.itemsSelectedCt!==0)?me.itemsSelectedCt:"No";
        });

        // update each widget within
        this.charts.forEach(function(chart){
            chart.refreshUI();
        });

        var filteredCount=0;
        this.filterList.forEach(function(filter){ filteredCount+=filter.isFiltered?1:0; })
        this.dom.filterClearAll.style("display",(filteredCount>0)?"inline-block":"none");

        if(this.updateCb) this.updateCb(this);

        setTimeout( function(){ me.updateLayout_Height(); }, 1750); // update layout after 1.75 seconds
    },
    /** -- */
    updateLayout_Height: function(){
        var chartHeaderHeight = parseInt(this.layoutHeader.style("height"))+5;

        var divHeight = this.domHeight();
        divHeight-=chartHeaderHeight;

        this.divWidth = this.domWidth();

        var divLineCount = Math.floor(divHeight/this.line_height);
        
        // number of barcharts, and initialize all charts as not processed yet
        var barChartCount = 0;
        var chartProcessed = [];
        var procBarCharts=0;
        var procBarChartsOld=-1;

        this.charts.forEach(function(chart){
            if(chart.type==='barChart'){ barChartCount++; }
            chartProcessed.push(false);
        })
        
        var divLineRem = divLineCount;
        var usedLines = 0;

        // timeline first ******************
        var c2=this.charts[0];
        if(c2.type==='scatterplot'){
            // uncollapse scatterplot only if total chart height is more than 15 rows
            if(divLineRem>15){
                var targetScatterplotHeight = Math.ceil(divLineRem/4);
                c2.setRowCount_VisibleAttribs(targetScatterplotHeight-c2.rowCount_Header()-1);
                chartProcessed[0]=true;
            } else { 
                c2.collapsedTime = true;
                // chartProcessed[0]=true; // categories are not processed
            }
        }

        // *********************************************************************************
        // left panel ***********************************************************************
        divLineRem = divLineCount;
        this.charts.forEach(function(chart,i){
            if(chart.type==='scatterplot' && chartProcessed[i]===true){
                divLineRem-=chart.rowCount_Total();
            }
        });

        var finalPass = false;
        while(procBarCharts<barChartCount){
            procBarChartsOld = procBarCharts;
            var targetRowCount = Math.floor(divLineRem/(barChartCount-procBarCharts));
            this.charts.forEach(function(chart,i){
                if(chartProcessed[i]) return;
                if(divLineRem<chart.rowCount_MinTotal()){
                    chart.divRoot.style("display","none");
                    chartProcessed[i] = true;
                    procBarCharts++;
                    chart.hidden = true;
                    return;
                } 
                if(chart.collapsedTime){
                    ; //
                } else if(chart.options.catDispCountFix){
                    chart.setRowCount_VisibleAttribs(chart.options.catDispCountFix);
                } else if(chart.rowCount_MaxTotal()<=targetRowCount){
                    // you say you have 10 rows available, but I only needed 5. Thanks,
                    chart.setRowCount_VisibleAttribs(chart.attribCount_Active);
                } else if(finalPass){
                    chart.setRowCount_VisibleAttribs(targetRowCount-chart.rowCount_Header()-1);
                } else {
                    return;
                }
                if(chart.hidden===undefined || chart.hidden===true){
                    chart.hidden=false;
                    chart.divRoot.style("display","block");
                }
                divLineRem-=chart.rowCount_Total();
                chartProcessed[i] = true;
                procBarCharts++;
            });
            finalPass = procBarChartsOld===procBarCharts;
        }

        // there may be some empty lines remaining, try to give it back to the facets
        var allDone = false;
        while(divLineRem>0 && !allDone){
            allDone = true;
            this.charts.every(function(chart){
                if(chart.hidden) return true;
                if(chart.collapsed) return true;
                if(chart.allAttribsVisible()) return true;
                if(chart.options.catDispCountFix!==undefined) return true;
                if(chart.type==='scatterplot' && chart.collapsedTime===false) return true;
                var tmp=divLineRem;
                divLineRem+=chart.rowCount_Total();
                chart.setRowCount_VisibleAttribs(chart.rowCount_Visible+1);
                divLineRem-=chart.rowCount_Total();
                if(tmp!==divLineRem) allDone=false;
                return divLineRem>0;
            });
        }

        var facetsHeight = (divLineCount-divLineRem)*this.line_height;

        this.layoutBackground.style("height",
            (this.fullWidthResultSet()?facetsHeight:divHeight)+"px");
        this.dom.leftBlockAdjustSize.style("height",
            (this.fullWidthResultSet()?facetsHeight:divHeight)+"px");

        this.charts.forEach(function(chart){
            chart.refreshVisibleAttribs();
        });
 
        var listDivTop = 0;
        // adjust vertical position
        if(this.fullWidthResultSet()){
            listDivTop = facetsHeight;
        } else {
            if(c2.type==='scatterplot'){
                listDivTop = c2.rowCount_Total_Right()*this.line_height;
            }
        }

        if(this.listDisplay) {
            // get height of list Header
            var listHeaderHeight=23; // Fixed height
            this.listDisplay.dom.listItemGroup
                .style("height",(divHeight-listDivTop-listHeaderHeight-15)+"px")
                ;
            if(c2.type==='scatterplot' && c2.collapsedTime){
                var difff = c2.rowCount_Total()*this.line_height-listDivTop;
                this.listDisplay.listDiv.style("top",(-difff)+"px");
            } else {
                this.listDisplay.listDiv.style("top","0px");
            }
        }
    },
    /** -- */
    updateLayout: function(){
        if(this.loaded!==true) return;

        this.divWidth = this.domWidth();

        var initBarChartWidth = this.width_leftPanel_bar;
        if(this.fullWidthResultSet() && this.isSmallWidth()){
            initBarChartWidth = this.divWidth-this.getRowTotalTextWidth()-20;
        } else{
            if(this.width_leftPanel_bar===undefined){
                if(this.barChartWidth===undefined) {
                    initBarChartWidth = Math.floor((this.divWidth-this.categoryTextWidth)/11);
                } else {
                    initBarChartWidth= this.barChartWidth;
                }
            } else {
                if(this.barChartWidth!==undefined) {
                    initBarChartWidth= this.barChartWidth;
                }
            }
        }

        this.setHideBarAxis(initBarChartWidth);

        // HEIGHT
        this.updateLayout_Height();

        // WIDTH
        this.setBarWidthLeftPanel(initBarChartWidth);
        this.updateAllTheWidth();
    },

    /** Not explicitly called, you can call this manually to change the text width size after the browser is created */
    setCategoryTextWidth: function(w){
        this.categoryTextWidth = w;
        this.charts.forEach(function(chart){
            chart.options.rowTextWidth = w;
            chart.refreshTextWidth(w);
            chart.updateBarWidth();
        });
        this.updateAllTheWidth();
    },
    setHideBarAxis: function(v){
        if(v>200) {
            this.hideBars = false;
            this.hideBarAxis = false;
        } else if(v>45){
            this.hideBars = false;
            this.hideBarAxis = false;
        } else if(v>10){
            this.hideBars = false;
            this.hideBarAxis = true;
        } else {
            this.hideBars = true;
            this.hideBarAxis = true;
            v = 0; 
        }
        if(this.forceHideBarAxis===true){
            this.hideBarAxis = true;
        }
        this.width_leftPanel_bar = v;

        if(this.hideBars===false){
            this.root.attr("hidebars",false);
        } else {
            this.root.attr("hidebars",true);
        }
        if(this.hideBarAxis===false){
            this.root.attr("hideBarAxis",false);
        } else {
            this.root.attr("hideBarAxis",true);
        }
    },
    /** -- */
    setBarWidthLeftPanel: function(v){
        this.setHideBarAxis(v);
        if(this.barMaxWidth===this.width_leftPanel_bar) return;
        this.barMaxWidth = this.width_leftPanel_bar;
        this.charts.forEach(function(chart){
            chart.updateBarAxisScale();
            chart.refreshWidth_Bars_Active();
            chart.refreshUIWidth();
        });
    },
    isSmallWidth: function(){
        return (this.categoryTextWidth + 260 > this.divWidth);
    },
    /** -- */
    fullWidthResultSet: function(){
        if(this.charts.length==1 && this.charts[0].type==='scatterplot')
            return true;
        if(this.isSmallWidth()) return true;
        return false;
    },
    /** -- */
    updateAllTheWidth: function(v){
        var width_leftPanel_total = this.getWidth_LeftPanel();
        var width_rightPanel_total = this.divWidth-width_leftPanel_total-this.scrollPadding-5; // 15 is padding

        this.layoutBackground.style("width",(width_leftPanel_total)+"px");

        this.charts.forEach(function(chart){
            if(chart.type==='scatterplot') chart.setTimeWidth(width_rightPanel_total);
        })

        // for some reason, on page load, this variable may be null. urgh.
        if(this.listDisplay){
            var width = (this.fullWidthResultSet() ? (this.divWidth-12) : (width_rightPanel_total+9));
            this.listDisplay.updateTotalWidth(width);
            
            var contentWidth = (width_rightPanel_total);
            if(this.fullWidthResultSet()) contentWidth+=width_leftPanel_total;
            this.listDisplay.updateContentWidth(contentWidth);
        }
    },
    /** -- */
    getFilteringState: function(facetTitle, itemInfo) {
        var r={
            results : this.itemsSelectedCt,
            textSrch: this.listDisplay.dom.bigTextSearch.value
        };

        // facet title parameters
        if(facetTitle !== null) r.facet = facetTitle;

        r.filtered="";
        r.selected="";

        r.itemInfo = itemInfo;

        this.charts.forEach(function(chart,i){
            // include time range if time is filtered
            if(chart.type==='scatterplot'){
                if(chart.isFiltered_Time()) r.timeFltr = 1;
            }
            if(chart.attribCount_Selected!==0){
                if(r.filtered!=="") { r.filtered+="x"; r.selected+="x"; }
                r.filtered+=i;
                r.selected+=chart.attribCount_Selected;
            }
        });

        if(r.filtered==="") r.filtered=null;
        if(r.selected==="") r.selected=null;

        return r;
    },
    hideListItemDetails: function(item){
        if(sendLog) sendLog(CATID.ItemBased,ACTID_ITEM.Collapse,{itemID:item.id()});
        item.listItem.setAttribute('details', false);
        this.lastSelectedItem = undefined;
    },
    showListItemDetails: function(item){
        if(sendLog) sendLog(CATID.ItemBased,ACTID_ITEM.Show,{itemID:item.id()});
        item.listItem.setAttribute('details', true);
        if(this.listDisplay.detailsToggle==="One"){
            if(this.lastSelectedItem){
                this.lastSelectedItem.listItem.setAttribute("details",false);
            }
        }
        this.lastSelectedItem = item;
    }
};





// ***********************************************************************************************************
// BASE CHART
// ***********************************************************************************************************

/**
 * KESHIF BAR CHART
 * @constructor
 */
kshf.BarChart = function(kshf_, options){
    // Call the parent's constructor
    var me = this;
    this.id = ++kshf.num_of_charts;
    this.parentKshf = kshf_;

    this.options = options;

    this.dom = {};

    this.selectType = "SelectOr";
    // COLLAPSED
    this.collapsed = false;
    if(options.collapsed===true) this.collapsed = true;
    // COLLAPSED TIME
    this.collapsedTime = false;
    if(options.collapsedTime===true) this.collapsedTime = true;
    // SORTING OPTIONS
    options.sortingOpts.forEach(function(opt){
        // apply defaults
        if(opt.no_resort===undefined) {
            opt.no_resort=false;
        }
        if(opt.func===undefined){
            opt.func=kshf.Util.sortFunc_ActiveCount_TotalCount;
        }
        if(opt.inverse===undefined){
            opt.inverse=false;
        }
    });
    this.sortingOpt_Active = options.sortingOpts[0];
    // ATTRTIBUTE MAPPING / FILTERING SETTINGS
    if(options.showNoneCat===undefined){
        options.showNoneCat = false;
    }
    if(options.removeInactiveAttrib===undefined){
        options.removeInactiveAttrib = true;
    }
    if(options.catLabelText===undefined){
        // get the 2nd attribute as row text [1st is expected to be the id]
        options.catLabelText = function(typ){ return typ.data[1]; };
    }

    this.showConfig = this.options.sortingOpts.length>1;

    this.attribFilter = kshf_.createFilter({
        name: this.options.facetTitle,
        browser: this.getKshf(),
        onClear: this.clearFilter_Attrib_cb,
        text_header: (this.options.textFilter?this.options.textFilter:this.options.facetTitle),
        text_item: this.text_item_Attrib,
        cb_this: this
    });

    if(!this.options.timeTitle){
        this.type = 'barChart';
    } else {
        this.type = 'scatterplot';
    }

    this.parentKshf.barMaxWidth = 0;
    this.options.timeMaxWidth=0;

    if(this.options.catItemMap===undefined){
        this.options.catItemMap = this.getKshf().columnAccessFunc(this.options.facetTitle);
    } else if(typeof(this.options.catItemMap)==="string"){
        this.options.catItemMap = this.getKshf().columnAccessFunc(this.options.catItemMap);
    }
    // generate row table if necessary
    if(this.options.generateRows){
        this.catTableName = this.options.catTableName+"_h_"+this.id;
        this.getKshf().createTableFromTable(this.getKshfItems(),this.catTableName, this.options.catItemMap,
            this.options.attribNameFunc);
    } else {
        this.catTableName = this.options.catTableName;
    }
    if(this.options.showNoneCat===true){
        // TODO: Check if a category named "None" exist in table
        var noneID = 10000;
        
        var newItem = new kshf.Item([noneID,"None"],0)
        newItem.browser = this.getKshf();
        kshf.dt[this.catTableName].push(newItem);
        kshf.dt_id[this.catTableName][noneID] = newItem;

        var _catItemMap = this.options.catItemMap;
        this.options.catItemMap = function(d){
            var r=_catItemMap(d);
            if(r===null) return noneID;
            if(r instanceof Array) if(r.length===0) return noneID;
            return r;
        }
        var _catLabelText = this.options.catLabelText;
        this.options.catLabelText = function(d){ 
            if(d.id()===noneID) return "None";
            return _catLabelText(d);
        };
        var _catTooltipText = this.options.catTooltipText;
        this.options.catTooltipText = function(d){ 
            if(d.id()===noneID) return "None";
            return _catTooltipText(d);
        };
    }

    this.mapAttribs(options);

    if(this.type === 'scatterplot'){
        if(this.options.timeItemMap===undefined){
            this.options.timeItemMap = this.getKshf().columnAccessFunc(this.options.timeTitle);
        }
        this.timeFilter = kshf_.createFilter({
            name: this.options.timeTitle,
            browser: this.getKshf(),
            onClear: this.clearFilter_Time_cb,
            text_item: this.text_item_Time,
            cb_this: this
        });
        this.getKshfItems().forEach(function(item){
            item.mappedData[this.timeFilter.id] = me.options.timeItemMap(item);
        },this)

        this.x_axis_active_filter = null;
        this.timeData_dt = {
            min: d3.min(this.getKshfItems(), this.options.timeItemMap),
            max: d3.max(this.getKshfItems(), this.options.timeItemMap)};

        // calculate minYear and maxYear per cetegory, and use it for total.
        this.updateAttrib_TimeMinMax();
        this.getAttribs().forEach(function(attrib){
            attrib.xMin = attrib.xMin_Dyn;
            attrib.xMax = attrib.xMax_Dyn;
        });
        if(this.options.timeBarShow===undefined){
            this.options.timeBarShow = false;
        }
    }

    if(this.options.subFilters){
        this.insertSubFacets();
    }
};

kshf.BarChart.prototype = {
    /** getKshf */
    getKshf: function(){
        return this.parentKshf;
    },
    /** getKshfItems */
    getKshfItems: function(){
        return this.parentKshf.items;
    },
    /** rowCount_Header_Left */
    rowCount_Header_Left: function(){
        var r=1; // title
        if(this.showConfig) {r++;}
        if(this.showTextSearch){ r++;}
        return r;
    },
    /** -- */
    rowCount_Header_Right: function(){
        if(this.type==='scatterplot'){
            if(this.collapsedTime) return 1;
            return 2;
        }
        return 0;
    },
    /** -- */
    rowCount_Header: function(){
        if(this.collapsed) return 1;
        return Math.max(this.rowCount_Header_Left(),this.rowCount_Header_Right());
    },
    /** -- */
    rowCount_Total: function(){
        if(this.collapsed) return 1;
        // need 1 more row at the bottom is scrollbar is shown, or barInfoText is set
        var bottomRow=0;
        if(!this.allAttribsVisible() || this.parentKshf.hideBarAxis===false) bottomRow=1;
        return this.rowCount_Header()+this.rowCount_Visible+bottomRow;
    },
    /** -- */
    rowCount_Total_Right: function(){
        if(this.type!=='scatterplot') return 0;
        if(this.collapsedTime===true || this.collapsed===true) return 1;
        return this.rowCount_Header_Right()+this.rowCount_Visible+1;
    },
    /** -- */
    rowCount_MaxTotal: function(){
        return this.rowCount_Header()+this.attribCount_Active+1;
    },
    /** -- */
    rowCount_MinTotal: function(){
        return this.rowCount_Header()+Math.min(this.attribCount_Active,3)+1;
    },
    /** -- */
    allAttribsVisible: function(){
        return this.attribCount_Active===this.rowCount_Visible;
    },
    /** -- */
    insertSubFacets: function(){
        var domID="kshf_subfacet_"+this.id;
        var me=this;
        var kshf_ = this.getKshf();
        this.subBrowserDom = kshf_.TopRoot.select(".subBrowsers").append("div").attr("id",domID).attr("class","subBrowser")
            .style("width","260px")
            .style("height",this.options.subFilters.divHeight+"px")
            ;
        var clear_cb = function(){
            firstPass=false; // pass next time updateCb is called
            me.subBrowser.clearFilters_All(false);
            syncBrowser();
        };
        var syncBrowser = function(){
            var attribTable = me.getAttribs_wID();
            var filterId = 5;
            me.getKshf().items.forEach(function(item){
                var attribId = me.options.catItemMap(item);
                var attrib = attribTable[attribId];
                var f=false;
                if(attrib){ 
                    f = attrib.wanted;
                }
                item.setFilter(filterId,f);
                item.updateSelected();
            });
        };
        var subFacetFilterSummaryTextFunc = function(){
            return "<b>"+me.subBrowser.itemsSelectedCt+" selected</b>";
        };

        this.subFacetFilter = kshf_.createFilter({
            name: "SubFacetFilter_"+this.id,
            browser: this.getKshf(),
            cb_this: this,
            onClear: clear_cb,
            // Do not show filtercrumb
            hideCrumb: true,
        });
        var firstPass = false;
        this.subBrowser = new kshf.Browser({
            domID : "#"+domID,
            dirRoot : kshf_.dirRoot,
            itemName : this.options.facetTitle,
            hideHeaderButtons: true,
            categoryTextWidth: this.options.subFilters.categoryTextWidth,
            subBrowser: true,
            source: { callback: function(browser){
                browser.primaryTableName = me.catTableName;
                browser.items = kshf.dt[browser.primaryTableName];
                browser.itemsSelectedCt = browser.items.length;
                browser.loadCharts();
            } },
            loadedCb: function(){
                // set browser of all primary items
                this.items.forEach(function(item){
                    item.browser = this;
                },this);
            },
            updateCb: function(browser){
                if(firstPass===false){
                    firstPass = true;
                    return;
                }
                if(browser.itemsSelectedCt===browser.items.length){
                    me.subFacetFilter.clearFilter(true);
                    return;
                }
                syncBrowser();
                me.subFacetFilter.addFilter(true);
            },
            charts: this.options.subFilters.charts
        });
        this.subBrowser.dom.filtercrumbs = kshf_.dom.filtercrumbs;
    },
    /** -- */
    mapAttribs: function(options){
        var filterId = this.attribFilter.id;
        this.getKshf().mapItemData(this.options.catItemMap, this.getAttribs_wID(), filterId);

        // Check if multiple value mapping
        this.hasMultiValueItem = false;
        this.getKshfItems().forEach(function(item){
            var toMap = item.mappedData[filterId];
            if(toMap===null) { return; }
            if(toMap instanceof Array) {
                if(toMap.length>1) this.hasMultiValueItem = true;
            }
        },this);

        // Modified internal dataMap function - Skip rows with0 active item count
        if(this.options.dataMap) {
            this._dataMap = function(d){
                if(d.items.length===0) {
                    return null; // auto remove empty attributes
                }
                return options.dataMap(d);
            };
        } else {
            this._dataMap = function(d){
                if(d.items.length===0) {
                    return null; // auto remove empty attributes
                }
                return d.id();
            };
        }

        this.updateAttribCount_Total();
        this.updateAttribCount_Active();
    	this.unselectAllAttribs();
    },
    /** -- */
    updateAttribCount_Total: function(){
        this.attribCount_Total = 0;
        this.getAttribs().forEach(function(d){
            if(this._dataMap(d)!==null) this.attribCount_Total++;
        },this);

        // text search is automatically enabled is num of rows is more than 20.
        // It is NOT dependent on number of displayed rows
        this.showTextSearch = (this.attribCount_Total>=20 && this.options.forceSearch!==false) ||
                               this.options.forceSearch===true;
    },
    /** -- */
    updateAttribCount_Active: function(){
        this.attribCount_Active = 0;
        this.getAttribs().forEach(function(d){
            if(this._dataMap(d)===null) return;
            if(this.isAttribVisible(d)===false) return;
            this.attribCount_Active++;
        },this);
    },
    /**  */
    getWidth_Total: function(){
        return this.getWidth_Left()+this.getWidth_Right();
    },
    /** -- */
    getWidth_Left: function(){
        return this.getKshf().getWidth_LeftPanel();
    },
    /** -- */
    getWidth_Right: function(){
        var kshf_ = this.getKshf();
        return (this.type==='scatterplot')?(kshf_.sepWidth+this.options.timeMaxWidth+kshf_.scrollWidth):0;
    },
    /** -- */
    refreshUIWidth: function(){
        var leftWidth = this.getWidth_Left();
        var rightWidth = this.getWidth_Right();
        var totalWidth = this.getWidth_Total();

        this.dom.leftHeader.style("width",leftWidth+"px");

        this.dom.chart_root2.style("width",totalWidth+"px");
        this.dom.attribGroup.style("width",totalWidth+"px");

        if(this.type==="scatterplot"){
            this.dom.rightHeader.style("width",rightWidth+"px");
            this.dom.middleScrollbar.style('left',(leftWidth-20)+'px');
            this.dom.chartRoot.select(".scrollToTop2").style('left',(leftWidth-15)+'px');
            if(this.collapsedTime){
                this.dom.attribGroup.style("width",leftWidth+"px");
                this.dom.chart_root2.style("width",leftWidth+"px");
            }
        }
    },
    /** -- */
    init_DOM: function(){
        var me = this;
        var kshf_ = this.getKshf();
        this.divRoot = this.options.layout
            .append("div").attr("class","kshfChart")
            .attr("removeInactiveAttrib",this.options.removeInactiveAttrib)
            .attr("filtered_attrib",false)
            .attr("inserted_attrib",false)
            .attr("collapsed",this.collapsed===false?"false":"true")
            .attr("collapsedTime",this.collapsedTime===false?"false":"true")
            .attr("hasMultiValueItem",this.hasMultiValueItem)
            ;

        this.dom = {};
               
        this.dom.headerGroup = this.divRoot.append("div").attr("class","headerGroup");

        var betweener = this.divRoot.append("div").style("position","relative");

        this.dom.chart_root2 = betweener
            .append("svg").attr("class","chart_root2").attr("xmlns","http://www.w3.org/2000/svg");
    	this.dom.chartRoot = betweener
            .append("div").attr("class","chart_root");

        this.dom.chartRoot.append("span").attr("class","scrollToTop")
            .html("⬆")
            .attr("title","Scroll To Top")
            .on("click",function(d){
                kshf.Util.scrollToPos_do(me.dom.attribGroup[0][0],0); // TODO
            });
        this.dom.scroll_display_more = this.dom.chartRoot.append("span").attr("class","scroll_display_more")
            .style("width",this.options.rowTextWidth+"px")
            .on("mousedown",function(){
                var scrollDom = me.dom.attribGroup[0][0];
                kshf.Util.scrollToPos_do(scrollDom,scrollDom.scrollTop+18);
                if(sendLog) {
                    sendLog(CATID.FacetScroll,ACTID_SCROLL.ClickMore, 
                        {facet:me.options.facetTitle});
                }
            })
            .on("mouseup",function(){
            })
            .on("mouseover",function(e){ 
                this.setAttribute("highlight",true);
            })
            .on("mouseout",function(){ 
                this.setAttribute("highlight",false);
            })
            ;

        if(this.type==="scatterplot"){
            if(this.options.timeDotConfig!==undefined){
                this.divRoot.attr("dotconfig",this.options.timeDotConfig);
            }
        }
        this.dom.x_axis = this.dom.chart_root2.append("g").attr("class", "x_axis")
            .on("mousedown", function (d, i) { d3.event.preventDefault(); });

        if(this.type==="scatterplot"){
            this.dom.middleScrollbar = this.dom.chartRoot.append("div").attr("class","middleScrollbar")
                .on("scroll",function(d){
                    me.dom.attribGroup[0][0].scrollTop = this.scrollTop;
                });
            this.dom.middleScrollbar.append("div").attr("class","filler");

            this.dom.chartRoot.append("span").attr("class","scrollToTop scrollToTop2")
                .html("⬆")
                .attr("title","Scroll To Top")
                .on("click",function(d){
                    kshf.Util.scrollToPos_do(me.dom.attribGroup[0][0],0); // TODO
                });
        }

        this.dom.scrollToTop = this.dom.chartRoot.selectAll(".scrollToTop");

        if(this.type==='scatterplot') { 
            this.dom.selectVertLine = this.dom.chartRoot.append("span").attr('class',"selectVertLine");
        }

    	this.dom.attribGroup = this.dom.chartRoot.append("div").attr("class","attribGroup")
            .on("scroll",function(d){
                if(kshf.Util.ignoreScrollEvents===true) return;
                var xx=this;
                me.dom.scrollToTop.style("visibility", this.scrollTop>0?"visible":"hidden");

                if(me.type==="scatterplot"){
                    me.dom.middleScrollbar.select(".filler").style("height",this.scrollHeight+"px");
                    me.dom.middleScrollbar[0][0].scrollTop = this.scrollTop;
                }

                me.updateScrollDisplayMore(Math.round(this.scrollTop / 18.0)+me.rowCount_Visible);
/*
                kshf_.root.on("mouseup", function(){
                    var targetPos = Math.round(xx.scrollTop/18.0) * 18;
                    kshf.Util.scrollToPos_do(this,targetPos);
                    kshf_.root.on("mouseup", null);
                });*/
            })
            ;

    	this.dom.attribGroup.selectAll("div.attib")
            // removes attributes with no items
    		.data(this.getAttribs(), this._dataMap)
    	  .enter().append("div").attr("class", "attrib")
            .each(function(d){
                var mee=this;
                d.barChart = me;
                // Add this DOM to each item under cats
                d.items.forEach(function(dd){dd.mappedAttribDOMs.push(mee);});
                d.facetDOM = this;
            })
    		;
        this.dom.attribs = this.dom.attribGroup.selectAll('div.attrib');

        if(this.type==='scatterplot') { 
        	this.dom.timeAxisGroup = this.dom.chart_root2.append("g").attr("class","timeAxisGroup")
        		.on("mousedown", function (d, i) { d3.event.preventDefault(); });
            this.dom.tickGroup = this.dom.timeAxisGroup.append("g").attr("class","tickGroup");
        }

        if(this.attribCount_Active===1){
            this.options.catBarScale = "scale_frequency";
        }

        this.insertHeader();

        this.insertAttribs();
        if(this.type==='scatterplot') { 
            this.insertTimeChartRows();
            this.insertTimeChartAxis_1();
        }
    },
    updateScrollDisplayMore: function(bottomItem){
        var me = this;
        this.dom.scroll_display_more
            .style("display",
                (this.attribCount_Active!==bottomItem)?"inline-block":"none")
            .text( (this.attribCount_Active-bottomItem)+" more..." );
    },
    /** -- */
    getAttribs: function(){
        return kshf.dt[this.catTableName];
    },
    /** -- */
    getAttribs_wID: function(){
        return kshf.dt_id[this.catTableName];
    },
    /** returns the maximum number of total items stored per row in chart data */
    getMaxTotalItemsPerRow: function(){
        if(!this._maxTotalItemsPerRow){
            var dataMapFunc = this._dataMap;
            this._maxTotalItemsPerRow = d3.max(this.getAttribs(), function(d){ 
                if(dataMapFunc(d)===null) { return null; }
                return d.items.length;
            });
        }
        return this._maxTotalItemsPerRow;
    },
    /** returns the maximum number of items stored per row in chart data */
    getMaxBarValuePerAttrib: function(){
        var dataMapFunc = this._dataMap;
        return d3.max(this.getAttribs(), function(d){ 
            if(dataMapFunc(d)===null) { return null; }
            return d.barValue;
        });
    },
    /** returns the maximum number of maximum items stored per row in chart data */
    getMaxBarValueMaxPerAttrib: function(){
        if(this._maxBarValueMaxPerAttrib) return this._maxBarValueMaxPerAttrib;
        var dataMapFunc = this._dataMap;
        this._maxBarValueMaxPerAttrib = d3.max(this.getAttribs(), function(d){ 
            if(dataMapFunc(d)===null) { return null; }
            return d.barValueMax;
        });
        return this._maxBarValueMaxPerAttrib;
    },
    /** -- */
    refreshUI: function(){
        this.updateBarAxisScale();
    	this.refreshActiveItemCount();
        if(this.type==="scatterplot"){
            this.refreshTimeChartBarDisplay();
            this.refreshTimeChartDotConfig();
        }
        this.refreshWidth_Bars_Active();
        if(this.options.removeInactiveAttrib){
            this.updateAttribCount_Active();
        }
    	this.updateSorting();
    },
    /** -- */
    updateAttrib_TimeMinMax: function(){
        var timeFilterId = this.timeFilter.id;
        var specFunc = function(item){
            if(!item.wanted) return undefined; // unwanted items have no time position
            return item.mappedData[timeFilterId];
        };
        this.getAttribs().forEach(function(row){
            if(row.sortDirty===false) return;
            row.xMin_Dyn = d3.min(row.items, specFunc);
            row.xMax_Dyn = d3.max(row.items, specFunc);
        });
    },
    /** refreshActiveItemCount */
    refreshActiveItemCount: function(){
        var me = this;
        this.dom.item_count.text(function(attrib){
            return "("+kshf.Util.formatForItemCount(attrib.barValue)+")"; 
        });
        this.dom.attribs.each(function(attrib){ 
            this.setAttribute("noitems",!me.isAttribSelectable(attrib));
        });
        this.dom.attribs.attr("title",(function(attrib){
            return (attrib.activeItems===0?"No":attrib.activeItems)+" selected "+me.getKshf().itemName+" "+
                (me.options.textFilter?me.options.textFilter:("- "+me.options.facetTitle+":"))+" "+
                ((me.options.catTooltipText)?me.options.catTooltipText(attrib):me.options.catLabelText(attrib));
        }));
    },
    /** -- */
    refreshWidth_Bars_Active: function(){
    	var me=this;
        this.dom.barGroup.style("width",this.getKshf().width_leftPanel_bar+"px");
    	this.dom.bar_active
            .each(function(attrib){
                var str="scaleX("+me.catBarAxisScale(attrib.barValue)+")";
                this.style.webkitTransform = str;
                this.style.MozTransform = str;
                this.style.msTransform = str;
                this.style.OTransform = str;
                this.style.transform = str;
            })
            ;
    },
    /** Applies alternating color for bar helper lines */
    refreshBarLineHelper: function(){
    	this.dom.row_bar_line.style("border-top-color", function(attrib,i) {
    		return (attrib.orderIndex%2===1)?"gray":"lightgray";
    	});
    },
    /** -- */
    getFilteredCount: function(){
        var r=this.isFiltered_Attrib();
        if(this.type==="scatterplot") r+=this.isFiltered_Time();
        return r;
    },
    /** -- */
    isFiltered_Attrib: function(state){
        return this.attribCount_Selected!==0;
    },
    /** -- */
    isFiltered_Time: function(){
    	return this.timeFilter_ms.min!==this.timeRange_ms.min ||
    	       this.timeFilter_ms.max!==this.timeRange_ms.max ;
    },
    attrib_UnselectAll: function(){
        this.attribCount_Selected = 0;
        this.attribCount_Included = 0;
        this.attribCount_Removed  = 0;
    },
    attrib_Include: function(v){
        this.attribCount_Selected+=v;
        this.attribCount_Included+=v;
    },
    attrib_Remove: function(v){
        this.attribCount_Selected+=v;
        this.attribCount_Removed+=v;
    },
    /** -- */
    unselectAllAttribs: function(){
        this.getAttribs().forEach(function(attrib){ attrib.f_unselect(); });
        this.attrib_UnselectAll();
    },
    /** -- */
    clearFilter_Attrib_cb: function(){
        // if text search is shown, clear that one
        if(this.showTextSearch){
            this.dom.clearTextSearch.style("display","none");
            this.dom.showTextSearch[0][0].value = '';
        }
        this.unselectAllAttribs();
        this.refreshAttribFilter();
    },
    /** -- */
    clearFilter_Time_cb: function(){
        this.resetTimeFilter_ms();
        this.resetTimeZoom_ms();
        this.refreshTimechartLayout(true);
        this.yearSetXPos();
        this.timeFilter.clearFilter(true);
    },
    /** resetTimeFilter_ms */
    resetTimeFilter_ms: function(){
        this.timeFilter_ms = { min: this.timeRange_ms.min, max:this.timeRange_ms.max };
    },
    /** resetTimeZoom_ms */
    resetTimeZoom_ms: function(){
        this.timeZoom_ms = { min: this.timeRange_ms.min, max:this.timeRange_ms.max };
    },
    /** -- */
    collapseAttribs: function(hide){
        this.collapsed = hide;
        if(sendLog) {
            if(hide===true) sendLog(CATID.FacetCollapse,ACTID_COLLAPSE.Collapse,{facet:this.options.facetTitle});
            else            sendLog(CATID.FacetCollapse,ACTID_COLLAPSE.Show,{facet:this.options.facetTitle});
        }
        this.divRoot.attr("collapsed",this.collapsed===false?"false":"true");
        this.getKshf().updateLayout_Height();
    },
    /** -- */
    collapseTime: function(hide){
        this.collapsedTime = hide;
        this.getKshf().updateLayout_Height();
        this.divRoot.attr("collapsedTime",this.collapsedTime===false?"false":"true");
        this.refreshUIWidth();
    },
    /** -- */
    refreshTimeAxisPosition: function(){
        var kshf_ = this.getKshf();
        this.dom.timeAxisGroup
            .transition().duration(kshf_.anim_layout_duration)
            .attr("transform","translate("+(kshf_.getWidth_LeftPanel()+kshf_.sepWidth-2)+","+
                (kshf_.line_height*this.rowCount_Visible)+")");
    },
    /** -- */
    insertHeader: function(){
    	var me = this;
        var kshf_ = this.getKshf();
        var rows_Left = this.rowCount_Header_Left();

        if(this.options.subFilters){
            // get titles of all filters
            var subFilters = this.options.subFilters.charts;
            var subFilterTitles = "";
            subFilters.forEach(function(filter){
                subFilterTitles+=filter.facetTitle+",";
            })

            this.dom.headerGroup.append("span").attr("class","SubFacetText")
                .text("Filters: "+subFilterTitles)
                .on("click",function(){
                    if(me.subBrowser.shown===true){
                        me.subBrowserDom.style("left","0px");
                        me.subBrowser.shown=false;
                    } else {
                        me.subBrowserDom.style("left","-290px");
                        me.subBrowser.shown=true;
                    }
                })
                ;
        }

        this.dom.leftHeader = this.dom.headerGroup.append("div").attr("class","leftHeader").style("width","0px");

        if(this.type==="scatterplot"){
            this.insertRightHeader();
        }

        this.dom.leftHeader.append("div").attr("class","border_line");
        var topRow_background = this.dom.leftHeader.append("div").attr("class","chartFirstLineBackground");
        this.dom.leftHeader.append("div").attr("class","border_line");

        var topRow = topRow_background.append("div").attr("class","leftHeader_XX");

        topRow.append("span").attr("class", "header_label")
            .attr("title", this.attribCount_Total+" attributes")
            .html(this.options.facetTitle)
            .on("click",function(){ 
                if(me.collapsed) { me.collapseAttribs(false); }
            })
            ;
        topRow.append("span").attr("class","header_label_arrow")
            .attr("title","Show/Hide attributes").text("▼")
            .on("click",function(){ me.collapseAttribs(!me.collapsed); })
            ;


        topRow.append("div")
            .attr("class","chartClearFilterButton rowFilter alone")
            .text('x').attr("title","Remove filter")
            .each(function(d){
                this.tipsy = new Tipsy(this, {
                    gravity: 'n',
                    fade: true,
                    opacity: 1,
                    title: function(){ 
                        return "<span class='big'>x</span class='big'> <span class='action'>Remove</span> filter"; 
                    }
                })
            })
            .on("mouseover",function(){
                this.tipsy.show();
            })
            .on("mouseout",function(d,i){
                this.tipsy.hide();
                d3.event.stopPropagation();
            })
    		.on("click", function(d,i){
                this.tipsy.hide();
                me.attribFilter.clearFilter(true);
                if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.ClearOnFacet,
                    me.getKshf().getFilteringState(me.options.facetTitle));
            })
            ;


        var header_belowFirstRow = this.dom.leftHeader.append("div").attr("class","header_belowFirstRow");

        var xxx=this.dom.leftHeader.append("svg")
            .attr("class", "resort_button")
            .attr("version","1.1")
            .attr("height","15px")
            .attr("width","15px")
            .attr("title","Settings")
            .attr("xml:space","preserve")
            .attr("viewBox","0 0 2000 1000")
            .style("left",(this.parentKshf.categoryTextWidth+5)+"px")
            .on("click",function(d){
                me.updateSorting(0);
                if(sendLog) sendLog(CATID.FacetSort,ACTID_SORT.ResortButton,{facet:me.options.facetTitle});
            })
            ;
        xxx.append("path")
            .attr("d",
                "M736 96q0 -12 -10 -24l-319 -319q-10 -9 -23 -9q-12 0 -23 9l-320 320q-15 16 -7 35q8 20 30 20h192v1376q0 14 9 23t23 9h192q14 0 23 -9t9 -23v-1376h192q14 0 23 -9t9 -23zM1792 -32v-192q0 -14 -9 -23t-23 -9h-832q-14 0 -23 9t-9 23v192q0 14 9 23t23 9h832 q14 0 23 -9t9 -23zM1600 480v-192q0 -14 -9 -23t-23 -9h-640q-14 0 -23 9t-9 23v192q0 14 9 23t23 9h640q14 0 23 -9t9 -23zM1408 992v-192q0 -14 -9 -23t-23 -9h-448q-14 0 -23 9t-9 23v192q0 14 9 23t23 9h448q14 0 23 -9t9 -23zM1216 1504v-192q0 -14 -9 -23t-23 -9h-256 q-14 0 -23 9t-9 23v192q0 14 9 23t23 9h256q14 0 23 -9t9 -23z")
            ;
        xxx.append("title").text("Move selected rows to top & re-order");

        // ************************************************************************************
        // ****** CONFIG LINE *****************************************************************

        if(this.showTextSearch){
            var textSearchRowDOM = header_belowFirstRow.append("div").attr("class","leftHeader_XX")
                .attr("class","chartRowLabelSearch")
                .style("white-space","nowrap").style("position","relative");
            this.dom.showTextSearch=textSearchRowDOM.append("input")
                .attr("type","text")
                .attr("placeholder","Search: "+this.options.facetTitle.toLowerCase())
                .on("input",function(){
                    if(this.timer){
                        clearTimeout(this.timer);
                    }
                    var x = this;
                    this.timer = setTimeout( function(){
                        var v=x.value.toLowerCase();
                        if(v===""){
                            textSearchRowDOM.select("svg.clearText").style("display","none");                
                            me.attribFilter.clearFilter(true);
                        } else {
                            textSearchRowDOM.select("svg.clearText").style("display","block");                     
                            me.attrib_UnselectAll();
                            me.getAttribs().forEach(function(attrib){
                                if(me.options.catLabelText(attrib).toString().toLowerCase().indexOf(v)!==-1){
                                    attrib.f_include();
                                } else {
                                    if(me.options.catTooltipText){
                                        if(me.options.catTooltipText(attrib).toLowerCase().indexOf(v)!==-1)
                                            attrib.f_include();
                                    } else{
                                        attrib.f_unselect();
                                    }
                                }
                                if(attrib.f_inserted()) me.attrib_Include(1);
                            });
                            if(!me.isFiltered_Attrib()){
                                me.attribFilter.clearFilter(true);                            
                            } else {
                                me.selectType = "SelectOr";
                                me.updateSelected_All();
                                me.refreshAttribFilter();
                                me.attribFilter.addFilter(true);
                            }
                        }

                        if(sendLog)
                            sendLog(CATID.FacetFilter,
                                ACTID_FILTER.CatTextSearch,
                                me.getKshf().getFilteringState(me.options.facetTitle));
                    }, 750);
                })
                .on("blur",function(){
                    d3.event.stopPropagation();
                    d3.event.preventDefault();
                })
                ;
            textSearchRowDOM.append("svg").attr("class","searchIcon")
                .attr("width","13")
                .attr("height","12")
                .attr("viewBox","0 0 491.237793 452.9882813")
                .attr("xmlns","http://www.w3.org/2000/svg")
                .append("use").attr("xlink:href","#kshf_svg_search")
            this.dom.clearTextSearch=textSearchRowDOM.append("svg").attr("class","clearText")
                .attr("width","13")
                .attr("height","13")
                .attr("viewBox","0 0 48 48")
                .attr("xmlns","http://www.w3.org/2000/svg")
                .append("use").attr("xlink:href","#kshf_svg_clearText")
                .on("click",function() {
                    me.attribFilter.clearFilter(true);
                });
        }

        var configGroup = header_belowFirstRow.append("div")
            .attr("class","configGroup leftHeader_XX")
            .attr("shown","order")
            ;

        if(this.showConfig) {
            var sortGr = configGroup.append("span").attr("class","sortOptionSelectGroup");
            sortGr.append("select").attr("class","optionSelect")
                .on("change", function(){
                    if(sendLog) {
                        sendLog(CATID.FacetSort,ACTID_SORT.ChangeSortFunc,
                            {facet:me.options.facetTitle, funcID:this.selectedIndex});
                    }
                    me.sortingOpt_Active = me.options.sortingOpts[this.selectedIndex];
                    me.updateSorting.call(me, 0);
                })
            .selectAll("input.sort_label")
                .data(this.options.sortingOpts)
              .enter().append("option")
                .attr("class", "sort_label")
                .text(function(d){ return d.name; })
                .attr(function(d){ return d.name; })
                ;
            sortGr.append("span").attr("class","optionSelect_Label").text("Order by");
        }
    },
    /** -- */
    insertRightHeader: function(){
        var me=this;
        this.dom.rightHeader = this.dom.headerGroup.append("span").attr("class","rightHeader");

        this.dom.rightHeader.append("div").attr("class","border_line");

        var firstLine = this.dom.rightHeader.append("div").attr("class","chartFirstLineBackground chartFirstLineBackgroundRight");
            firstLine.append("span").attr("class","header_label_arrow")
                .attr("title","Show/Hide categories").text("▼")
                .on("click",function(){ me.collapseTime(!me.collapsedTime); })
                ;
            firstLine.append("span")
                .attr("class", "header_label")
                .text(this.options.timeTitle)
                .on("click",function(){ if(me.collapsedTime) { me.collapseTime(false); } })
                ;
            firstLine.append("div")
                .attr("class","chartClearFilterButton timeFilter alone")
                .attr("title","Remove filter")
                .on("click", function(d,i){ 
                    me.timeFilter.clearFilter(true);
                    if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.ClearOnFacet, 
                        {facet:me.options.timeTitle,results:me.getKshf().itemsSelectedCt});
                })
                .text('x');

        this.dom.rightHeader.append("div").attr("class","border_line");

        var config_zoom = this.dom.rightHeader.append("div").attr("class","config_zoom");

        config_zoom.append("span")
            .attr("class","zoom_button zoom_in")
            .attr("disabled","true")
            .text("⇥ Zoom in ⇤")
            .on("click",function(d){
                me.timeZoom_ms = { min: me.timeFilter_ms.min, max: me.timeFilter_ms.max };
                me.useCurrentTimeMinMax = true;
                me.refreshTimechartLayout(true);
                me.useCurrentTimeMinMax = undefined;
                me.divRoot.select(".zoom_out").attr("disabled","false");
                me.divRoot.select(".zoom_in").attr("disabled","true");
            });
        config_zoom.append("span")
            .attr("class","zoom_button zoom_out")
            .attr("disabled","true")
            .text("⇤ Zoom out ⇥")
            .on("click",function(){
                me.resetTimeZoom_ms();
                me.useCurrentTimeMinMax = true;
                me.refreshTimechartLayout(true);
                me.useCurrentTimeMinMax = undefined;
                me.divRoot.select(".zoom_out").attr("disabled","true");
            })
            ;
    },
    /** -- */
    refreshTimechartLayout: function(toUpdate){
        this.setTimeTicks();
        this.updateTimeChartBarsDots();
        this.refreshTimeChartBarDisplay();
        this.insertTimeTicks();
        this.insertTimeChartAxis();
        if(toUpdate===true) this.refreshTimeChartDotConfig();
    },
    /** -- */
    setTimeWidth: function(w){
        w = w-this.getKshf().scrollWidth;
        this.options.timeMaxWidth = w; // 15px is for scrollbar

        this.refreshTimechartLayout(true);
        this.refreshUIWidth();
        this.updateRowBarLineWidth();
    },
    /** -- */
    refreshTimeChartDotConfig: function(){
        if(this.type!=='scatterplot') return;
        if(this.options.timeDotConfig !== undefined) return;
        if(this.skipUpdateTimeChartDotConfig === true) return;
        var me = this;

        var totalActiveTime_pixLength = 0;

        this.dom.attribs.each(function(attrib) {
            if(me.isFiltered_Attrib() && !attrib.f_selected()) return;
            if(attrib.xMax_Dyn===undefined || attrib.xMin_Dyn===undefined) return;
            totalActiveTime_pixLength+=me.timeScale(attrib.xMax_Dyn) - me.timeScale(attrib.xMin_Dyn);
        });

        var timeFilterDiff = this.timeFilter_ms.max-this.timeFilter_ms.min;
        var timeZoomDiff = this.timeZoom_ms.max-this.timeZoom_ms.min;

        // how much width of time does each dot take?
        var dotPixelWidth = 12;
    //        var timeFilterWidth = this.options.timeMaxWidth*(totalActiveTimeRange_ms/timeZoomDiff);
    //        var maxDotsPerRow = timeFilterWidth/dotPixelWidth;
        var maxDots = totalActiveTime_pixLength/dotPixelWidth;
    //        var dotTimeWidth = (this.options.timeMaxWidth/10) dots can represent
    //        x*dotTimeWidth = this.options.timeMaxWidth;
        
        var numOfItems = this.parentKshf.itemsSelectedCt;

        // some metric on number of dots that can fit inside. The bigger, the more items an be shown without overlap
    //        var mmm = *(totalActiveTime_ms/timeZoomDiff)/10;

        if(maxDots>numOfItems*3 || totalActiveTime_pixLength===0){
            this.dom.timeDots.attr("fill","default");
        } else {
            this.dom.timeDots.attr("fill","gradient100");
            if(maxDots>numOfItems*1.5){
                this.dom.timeDots.attr("fill","gradient100");
            } else if(maxDots>numOfItems*0.8){
                this.dom.timeDots.attr("fill","gradient75");
            } else if(maxDots>numOfItems*0.3){
                this.dom.timeDots.attr("fill","gradient50");
            } else {
                this.dom.timeDots.attr("fill","gradient25");
            }
        }
    },
    /** -- */
    updateBarAxisScale: function(){
        if(this.options.catBarScale==="scale_frequency"){
            this.catBarAxisScale = d3.scale.linear()
                .domain([0,this.parentKshf.itemsSelectedCt])
                .rangeRound([0, this.parentKshf.barMaxWidth]);
        } else {
            this.catBarAxisScale = d3.scale.linear()
                .domain([0,this.getMaxBarValuePerAttrib()])
                .rangeRound([0, this.parentKshf.barMaxWidth]);
        }
        this.refreshWidth_Bars_Total();
        this.insertXAxisTicks();
    },
    /** -- */
    updateBarWidth: function(w){
        this.updateBarAxisScale();
        this.refreshWidth_Bars_Active();
        this.updateRowBarLineWidth();
        this.refreshUIWidth();
    },
    /** -- */
    updateRowBarLineWidth: function(){
        var kshf_ = this.getKshf();
        this.dom.row_bar_line.style("width",(kshf_.barMaxWidth+kshf_.sepWidth+this.options.timeMaxWidth+kshf_.scrollWidth)+"px");
    },
    /** -- */
    getMaxVisibleFirstRow: function(){
        return this.attribCount_Active-this.rowCount_Visible;
    },
    /** -- */
    setRowCount_VisibleAttribs: function(c){
        if(c<0) c=1;
        if(c>this.attribCount_Active) c=this.attribCount_Active;
        if(this.attribCount_Active<=2){ 
            c = this.attribCount_Active;
        } else {
            c = Math.max(c,2);
        }
        this.rowCount_Visible = c;
        this.updateScrollDisplayMore(this.rowCount_Visible);
    },
    /** -- */
    refreshVisibleAttribs: function(){
        var kshf_ = this.getKshf();
        var totalHeight      = kshf_.line_height*this.rowCount_Total();
        var visibleRowHeight = kshf_.line_height*this.rowCount_Visible;
        var headerHeight     = kshf_.line_height*this.rowCount_Header();

        this.divRoot.attr("selectType",this.selectType);
        this.divRoot.style("height",totalHeight+"px");

        this.dom.attribGroup.style("height",visibleRowHeight+"px");
        if(this.type==="scatterplot"){
            this.dom.middleScrollbar.style("height",visibleRowHeight+"px");
        }

        this.dom.x_axis.selectAll("g.tick line")
            .transition().duration(kshf_.anim_layout_duration)
            .attr("y2", visibleRowHeight)
            ;
        this.dom.x_axis.selectAll("g.tick text")
            .transition().duration(kshf_.anim_layout_duration)
            .attr("dy",visibleRowHeight+5);

        if(this.type==='scatterplot'){
            this.refreshTimeAxisPosition();
            // update x axis items
            this.dom.timeAxisGroup.selectAll("g.filter_handle line")
                .transition().duration(kshf_.anim_layout_duration)
                .attr("y1", -visibleRowHeight-8)
                .attr("y2", -8)
                ;
            this.dom.timeAxisGroup.selectAll("rect.filter_nonselected")
        //        .transition().duration(kshf_.anim_layout_duration)
                .attr("y",-visibleRowHeight-8)
                .attr("height", visibleRowHeight)
                ;
            this.dom.selectVertLine
                .style("height", (kshf_.line_height*(this.rowCount_Visible))+"px")
                ;
        }
    },
    /** Returns true when all current selections appear in the itemList */
    filter_multi_and: function(itemList) {
        // ALL of the current selection is in item mappings
        // see how many items return true. If it matches current inserted count, then all selections are met for this item
        var t=0;
        var removed=false;
        itemList.forEach(function(m){
            if(removed) return;
            if(m.f_included()){
                t++;
            } else if(m.f_removed()){
                removed = true; // well, we have a removed item attribute here. BAM!
            }
        })
        if(removed) return false;
        return (t===this.attribCount_Included);
    },
    /** update ItemFilterState_Attrib */
    updateItemFilterState_Attrib: function(){
        if(!this.isFiltered_Attrib()){
            return;
        }

        var filter_multi_removed = kshf.Util.filter_multi_removed;

        var filterId = this.attribFilter.id;
        if(this.selectType==="SelectAnd"){
            var filter_multi = this.filter_multi_and;
            this.getKshfItems().forEach(function(item){
                var attribItem=item.mappedData[filterId];
                var f = false;
                if(attribItem!==null){ 
                    if(attribItem instanceof Array){
                        if(this.attribCount_Removed>0 && filter_multi_removed.call(this,attribItem)){
                            f = false;
                        } else {
                            if(this.attribCount_Included>0)
                                f = filter_multi.call(this,attribItem);
                            else
                                f = true;
                        }
                    } else {
                        // one mapped value only
                        // more than 1 item is selected, and this item only has 1 mapping.
                        f = false;
                    }
                }
                item.setFilter(filterId,f);
            },this);
        } else {
            // selectType is "SelectOr"
            var filter_multi = kshf.Util.filter_multi_or;
            this.getKshfItems().forEach(function(item){
                var attribItem=item.mappedData[filterId];
                var f = false;
                if(attribItem!==null){ 
                    if(attribItem instanceof Array){
                        if(this.attribCount_Removed>0 && filter_multi_removed.call(this,attribItem)){
                            f = false;
                        } else {
                            if(this.attribCount_Included>0)
                                f = filter_multi.call(this,attribItem);
                            else
                                f = true;
                        }
                    } else {
                        // one mapped value only
                        if(attribItem.f_removed()){
                            //f = false;
                        } else {
                            if(this.attribCount_Included===0)
                                f = true;
                            else
                                f = attribItem.f_included();
                        }
                    }
                }
                item.setFilter(filterId,f);
            },this);
        }
    },
    /** update ItemFilterState_Time */
    updateItemFilterState_Time: function(){
        var filterId = this.timeFilter.id;
        this.getKshfItems().forEach(function(item){
            var timePos = item.mappedData[filterId];
            item.setFilter(filterId,
                (timePos>=this.timeFilter_ms.min) && (timePos<=this.timeFilter_ms.max)
            );
            item.updateSelected();
        },this);
    },
    /** update Selected_AllItems */
    updateSelected_All: function(){
        this.updateItemFilterState_Attrib();
        this.getKshfItems().forEach(function(item){ item.updateSelected(); });
    }, 
    /** update Selected_UnSelectOnly */
    updateSelected_UnSelectOnly: function(){
        this.updateItemFilterState_Attrib();
        this.getKshfItems().forEach(function(item){ item.updateSelected_UnSelectOnly(); });
    },
    /** update Selected_SelectOnly */
    updateSelected_SelectOnly: function(){
        this.updateItemFilterState_Attrib();
        this.getKshfItems().forEach(function(item){ item.updateSelected_SelectOnly(); });
    },
    /** -- */
    isAttribVisible: function(attrib){
        // Show selected attribute always
        if(attrib.f_selected()) return true;
        // Show if number of active items is not zero
        if(attrib.activeItems!==0) return true;

        if(this.options.removeInactiveAttrib===false) return true;

        // facet is not filtered yet, cannot click on 0 items
        if(!this.isFiltered_Attrib()) return attrib.activeItems!==0;
        
        // Hide if multiple options are selected and selection is and
        if(this.selectType==="SelectAnd") return false;
        // TODO: Figuring out non-selected, zero-active-item attribs under "SelectOr" is tricky!

        if(attrib.wanted===false) return false;

        return true;
    },
    /** -- */
    isAttribSelectable: function(attrib){
        // Show selected attribute always
        if(attrib.f_selected()) return true;
        // Show if number of active items is not zero
        if(attrib.activeItems!==0) return true;

        // Show if multiple attributes are selected and the facet does not include multi value items
        if(this.isFiltered_Attrib() && !this.hasMultiValueItem) return true;

        // Hide
        return false;
    },
    removeAttrib: function(attrib){
        if(attrib.f_removed()){
            attrib.f_unselect();
        } else {
            // if number of items in this attrib equals to current result count, do nothing!
            if(attrib.barValue===this.getKshf().itemsSelectedCt){
                alert("Removing this attribute would make an empty result set, so it is not allowed.");
                return;
            }
            attrib.f_remove();
        }
        this.attrib_Remove(attrib.f_removed()?1:-1);

        if(!this.isFiltered_Attrib()){
            this.attribFilter.clearFilter(true);
            return;
        }

        if(attrib.f_removed()){
            this.updateSelected_UnSelectOnly();
        } else {
            this.updateSelected_SelectOnly();
        }

        if(this.dom.showTextSearch) this.dom.showTextSearch[0][0].value="";
        this.refreshAttribFilter();
        this.attribFilter.addFilter(true);
    },
    /** When clicked on an attribute ... */
    filterAttrib: function(attrib, selectOr){
        if(attrib.f_included()){
            attrib.f_unselect();
        } else if(attrib.f_removed()){
            this.removeAttrib(attrib);
            return;
        } else {
            attrib.f_include();
        }
        this.attrib_Include(attrib.f_included()?1:-1);

        if(!this.isFiltered_Attrib()){
            this.attribFilter.clearFilter(true);
            return;
        } 

        if(attrib.f_included()){
            // attrib is added to filtering
            if(this.attribCount_Included===1){
                this.selectType = "SelectOr";
                this.updateSelected_UnSelectOnly();
            } else {
                // this.attribCount_Included > 1
                if(this.hasMultiValueItem){
                    if(this.attribCount_Included===2){
                        this.selectType = (selectOr===undefined)?"SelectAnd":"SelectOr";
                    }
                    if(this.selectType==="SelectAnd"){
                        this.updateSelected_UnSelectOnly();
                    } else {
                        this.updateSelected_SelectOnly();
                    }
                } else {
                    // NO MultiValueItem
                    if(selectOr===true){
                        // or selection with multiple items
                        this.updateSelected_SelectOnly();
                    } else {
                        // Removing previously selected attributes
                        this.unselectAllAttribs();
                        attrib.f_include();
                        this.attribCount_Selected = 1;
                        this.attribCount_Included = 1;
                        this.updateSelected_All();
                    }
                }
            }
        } else {
            // attrib is removed from filtering, and there are still some items...
            if(this.hasMultiValueItem){
                if(this.selectType==="SelectAnd"){
                    this.updateSelected_SelectOnly();
                } else {
                    this.updateSelected_UnSelectOnly();
                }
                if(this.attribCount_Included===1){
                    this.selectType = "SelectOr";
                }
            } else {
                this.updateSelected_UnSelectOnly();
            }
        }
        if(this.dom.showTextSearch) this.dom.showTextSearch[0][0].value="";
        this.refreshAttribFilter();
        this.attribFilter.addFilter(true);
    },
    /** -- */
    refreshAttribFilter: function(){
        this.divRoot.attr("filtered_attrib",this.attribCount_Selected>0);
        this.divRoot.attr("inserted_attrib",this.attribCount_Included>0);
        // 1, 0, -1
        this.dom.attribs.attr("selected",function(attrib){ return attrib.selected; });
    },
    /** -- */
    text_item_Attrib: function(){
        // go over all items and prepare the list
        var selectedItemsText="";
        var selectedItemsCount=0;
        var catLabelText = this.options.catLabelText;
        var catTooltipText = this.options.catTooltipText;
        this.getAttribs().forEach( function(attrib){
            if(!attrib.f_selected()) return; 
            if(selectedItemsCount!==0) {
                if(this.selectType==="SelectAnd" || attrib.f_removed()){
                    selectedItemsText+=" and "; 
                } else{
                    selectedItemsText+=" or "; 
                }
            }
            var labelText = catLabelText(attrib);
            if(attrib.f_removed()) labelText = "not " + labelText;
            var titleText = labelText;
            if(catTooltipText) titleText = catTooltipText(attrib);

            selectedItemsText+="<b>"+labelText+"</b>";
            selectedItemsCount++;
        },this);
        return selectedItemsText;
    },
    /** - */
    insertAttribs: function(){
    	var me = this;
        var kshf_ = this.getKshf();

        var onFilterAttrib = function(attrib){
            if(attrib.facetDOM.tipsy_active)
                attrib.facetDOM.tipsy_active.hide();
            me.filterAttrib(attrib);
            // get label
            var attribLabel = me.options.catLabelText(attrib);

            if (this.timer) {
                // double click
                clearTimeout(this.timer);
                this.timer = null;
                me.unselectAllAttribs();
                me.filterAttrib(attrib);
                if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.CatValueExact,
                    kshf_.getFilteringState(me.options.facetTitle,attribLabel));
                return;
            } else if(sendLog){
                if(sendLog) sendLog(CATID.FacetFilter,(attrib.selected)?ACTID_FILTER.CatValueAdd:ACTID_FILTER.CatValueRemove,
                    kshf_.getFilteringState(me.options.facetTitle,attribLabel));
            }
            var x = this;
            this.timer = setTimeout(function() { x.timer = null; }, 500);
        };

        var onMouseOver = function(attrib,i){
            if(!me.isAttribSelectable(attrib)) return;
            attrib.facetDOM.setAttribute("highlight",true);
            attrib.items.forEach(function(item){if(item.wanted) item.highlightListItem();});
            
            attrib.facetDOM.tipsy_active = d3.select(attrib.facetDOM).select(".item_count")[0][0].tipsy;
            if(!attrib.f_selected() & me.attribCount_Included>1 && me.selectType==="SelectOr"
                && me.hasMultiValueItem){
                // prevent "...and" and show "...or" instead
                attrib.facetDOM.tipsy_active = d3.select(attrib.facetDOM).select(".filter_add_more .add")[0][0].tipsy;
            }
            attrib.facetDOM.tipsy_active.show()
        };
        var onMouseOut = function(attrib,i){
            if(!me.isAttribSelectable(attrib)) return;
            attrib.facetDOM.setAttribute("highlight",false);
            attrib.items.forEach(function(item){if(item.wanted) item.nohighlightListItem();});
            if(attrib.facetDOM.tipsy_active)
                attrib.facetDOM.tipsy_active.hide();
        };

    	this.dom.attribs
            .attr("highlight","false")
            .attr("selected","0")
            ;
        
        this.dom.add_more = this.dom.attribs.append("span").attr("class", "filter_add_more");
            this.dom.add_more.append("span").attr("class","add").text("⊕")
                .each(function(){
                    this.tipsy = new Tipsy(this, {
                        gravity: 'sw',
                        offset_y: 5,
                        offset_x: 1,
                        fade: true,
                        title: function(){
                            var attrib = this.__data__;
                            return "<span class='big'>+</span> <span class='action'>Add</span> <i>"+
                                    me.options.facetTitle+"</i> (<b> ... or </b>)";
                        }
                    });
                })
                .on("mouseover",function(attrib,i){
                    this.tipsy.show();
                    this.parentNode.parentNode.setAttribute("highlight",true);
                    d3.event.stopPropagation();
                })
                .on("mouseout",function(attrib,i){
                    this.tipsy.hide();
                    this.parentNode.parentNode.setAttribute("highlight",false);
                    d3.event.stopPropagation();
                })
                .on("click",function(attrib,i){
                    me.filterAttrib(attrib,true);
                    this.tipsy.hide();
                    d3.event.stopPropagation();
                });

            this.dom.add_more.append("span").attr("class","remove").text("⊖")
                .each(function(){
                    this.tipsy = new Tipsy(this, {
                        gravity: 'sw',
                        offset_y: 5,
                        offset_x: 1,
                        fade: true,
                        title: function(){
                            var attrib = this.__data__;
                            return "<span class='big'>+</span> <span class='action'>Remove</span> <i>"+
                                me.options.facetTitle+"</i>";
                        }
                    });
                })
                .on("mouseover",function(attrib,i){
                    this.tipsy.show();
                    this.parentNode.parentNode.setAttribute("highlight",true);
                    d3.event.stopPropagation();
                })
                .on("mouseout",function(attrib,i){
                    this.tipsy.hide();
                    this.parentNode.parentNode.setAttribute("highlight",false);
                    d3.event.stopPropagation();
                })
                .on("click",function(attrib,i){
                    me.removeAttrib(attrib);
                    this.tipsy.hide();
                    d3.event.stopPropagation();
                });


        this.dom.attribs.append("span").attr("class", "clickArea")
            .style("width",(kshf_.getRowTotalTextWidth())+"px")
            .on("click", onFilterAttrib)
            .on("mouseover",onMouseOver)
            .on("mouseout",onMouseOut)
            ;

    	this.dom.attribs.append("span").attr("class", "label")
            .style("width", (this.options.rowTextWidth)+"px")
    		.text(this.options.catLabelText);
        this.dom.item_count = this.dom.attribs.append("span").attr("class", "item_count")
            .style("width",(this.getKshf().getRowLabelOffset())+"px")
            .each(function(){
                this.tipsy = new Tipsy(this, {
                    gravity: 'w',
                    offset_x: 2,
                    offset_y: -1,
                    fade: true,
                    title: function(){
                        var attrib=this.__data__;
                        var attribName=me.options.facetTitle;
                        var hasMultiValueItem=attrib.barChart.hasMultiValueItem;
                        if(attrib.f_included() || attrib.f_removed())
                            return "<span class='big'>-</span class='big'> <span class='action'>Remove</span> from filter";
                        if(attrib.barChart.attribCount_Included===0)
                            return "<span class='big'>+</span> <span class='action'>Add</span> <i>"+
                                attribName+"</i> Filter";
                        if(hasMultiValueItem===false)
                            return "<span class='big'>&laquo;</span> <span class='action'>Change</span> <i>"+
                                attribName+"</i> Filter";
                        else
                            return "<span class='big'>+</span> <span class='action'>Add</span> <i>"+
                                attribName+"</i> (<b> ... and </b>)";
                    }
                });
            })
            ;
        this.dom.barGroup = this.dom.attribs.append("span").attr("class","barGroup");
    	this.dom.bar_active = this.dom.barGroup.append("span")
    		.attr("class", function(d,i){ 
    			return "bar rowBar active "+(me.options.barClassFunc?me.options.barClassFunc(d,i):"");
    		})
            .on("click", onFilterAttrib)
            .on("mouseover",onMouseOver)
            .on("mouseout",onMouseOut)
            ;
    	this.dom.bar_total = this.dom.barGroup.append("span")
    		.attr("class", function(d,i){ 
    			return "bar rowBar total "+(me.options.barClassFunc?me.options.barClassFunc(d,i):"");
    		});
        this.dom.allRowBars = this.dom.attribs.selectAll('span.rowBar');

        this.refreshTextWidth();
    },
    /** -- */
    refreshTextWidth: function(){
        var kshf_ = this.getKshf();

        this.dom.headerGroup.selectAll(".leftHeader_XX")
            .style("width",this.options.rowTextWidth+"px");
        this.dom.x_axis
            .attr("transform","translate("+(kshf_.getRowTotalTextWidth()+3)+",0)");

        if(this.dom.showTextSearch)
            this.dom.showTextSearch.style("width",(this.options.rowTextWidth-20)+"px")
    },
    /** -- */
    refreshWidth_Bars_Total: function(){
        var me = this;
        this.dom.bar_total
            .each(function(attrib){
                var str="scaleX("+Math.min(me.catBarAxisScale(attrib.barValueMax),me.parentKshf.barMaxWidth+7)+")";
                this.style.webkitTransform = str;
                this.style.MozTransform = str;
                this.style.msTransform = str;
                this.style.OTransform = str;
                this.style.transform = str;
            });
    },
    /** -- */
    sortAttribs: function(){
        var me = this;
        var selectedOnTop = this.sortingOpt_Active.no_resort!==true;
        var inverse = this.sortingOpt_Active.inverse;
        var sortFunc = this.sortingOpt_Active.func;

        var idCompareFunc = function(a,b){return b-a;};
        if(typeof(this.getAttribs()[0].id())==="string") 
            idCompareFunc = function(a,b){return b.localeCompare(a);};

        var theSortFunc = function(a,b){
            if(selectedOnTop){
                if(!a.f_selected() &&  b.f_selected()) return  1;
                if( a.f_selected() && !b.f_selected()) return -1;
            }
            // put the items with zero active items to the end of list (may not be displayed / inactive)
            if(a.activeItems===0 && b.activeItems!==0) return  1;
            if(b.activeItems===0 && a.activeItems!==0) return -1;

            if(!a.wanted && b.wanted) return  1;
            if( a.wanted &&!b.wanted) return -1;

            var x=sortFunc(a,b);
            if(x===0) x=idCompareFunc(a.id(),b.id());
            if(inverse) x=-x;
            return x;
        };
        this.getAttribs().sort(theSortFunc);
        this.getAttribs().forEach(function(attrib,i){ attrib.orderIndex=i; });
    },
    /** -- */
    updateSorting: function(sortDelay){
        var kshf_ = this.getKshf();
        var me = this;
        if(sortDelay===undefined) sortDelay = 450;
        this.sortAttribs();

        setTimeout(function(){
            var attribGroupScroll = me.dom.attribGroup[0][0];
            // always scrolls to top row automatically when re-sorted
            kshf.Util.scrollToPos_do(attribGroupScroll,0);
            me.dom.attribs.style('display',function(attrib){
                return me.isAttribVisible(attrib)?"block":"none";
            });
            if(me.sortedBefore){
                me.dom.attribs.data(me.getAttribs(), me._dataMap)
                    .order()
                    .transition().duration(0)
                    .delay(function(d, i) { return Math.min(i*10,600); })
                    .each(function(attrib,i){
                        var str="translateY("+(kshf_.line_height*i)+"px)";
                        this.style.webkitTransform = str;
                        this.style.MozTransform = str;
                        this.style.msTransform = str;
                        this.style.OTransform = str;
                        this.style.transform = str;
                    });
            } else {
                me.dom.attribs.data(me.getAttribs(), me._dataMap)
                    .order()
                    // no transition
                    .each(function(attrib,i){
                        var str="translateY("+(kshf_.line_height*i)+"px)";
                        this.style.webkitTransform = str;
                        this.style.MozTransform = str;
                        this.style.msTransform = str;
                        this.style.OTransform = str;
                        this.style.transform = str;
                    });
                if(me.type==="scatterplot"){
                    me.dom.middleScrollbar.select(".filler").style("height",attribGroupScroll.scrollHeight+"px");
                    me.dom.middleScrollbar[0][0].scrollTop = attribGroupScroll.scrollTop;
                }

            }
            
            me.sortedBefore = true;
            if(me.type==='scatterplot') me.refreshBarLineHelper();
            me.divRoot.attr("canResort",false);
        },sortDelay);
    },
    /** -- */
    insertXAxisTicks: function(){
        var ticksSkip = this.parentKshf.barMaxWidth/25;
        if(this.getMaxBarValuePerAttrib()>100000){
            ticksSkip = this.parentKshf.barMaxWidth/30;
        }

        var xAxis = d3.svg.axis()
            .tickSize(0, 0, 0)
    		.orient('bottom')
    		.ticks(ticksSkip)
    		.tickFormat(d3.format("s"))
            .scale(this.catBarAxisScale);

    	this.dom.x_axis.call(xAxis);

        // no animation! by default it is inserted at 0, we need to update it without animation	
        this.dom.x_axis.selectAll("g.tick text")
            .attr("dy",this.getKshf().line_height*this.rowCount_Visible+5);
    	this.dom.x_axis.selectAll("g.tick line")
            .attr("y1","0")
            .attr("y2",this.getKshf().line_height*this.rowCount_Visible);
    },
    /** -- */
    removeXAxis: function(){
        this.dom.x_axis.data([]).exit().remove();
    },
    /** -- */
    refreshTimeChartBarDisplay: function(){
        // key dots are something else
        var me = this;
        var kshf_ = this.getKshf();
        var r;
        var rows = this.getAttribs();
        var timeFilterId = this.timeFilter.id;
        
        var timeChartSortFunc = function(a,b){
            if(a.f_selected()&&!b.f_selected()) { return  1; }
            if(b.f_selected()&&!a.f_selected()) { return -1; }
            // use left-to-right sorting
            var posA = a.mappedData[timeFilterId];
            var posB = b.mappedData[timeFilterId];
            if(posA===null || posB===null) { return 0; }
            return posA.getTime()-posB.getTime();
        };
        
        rows.forEach(function(attrib){
            if(!attrib.sortDirty || this.type!=="scatterplot") return;
            attrib.items.sort(timeChartSortFunc);
            this.dom.attribs.selectAll(".timeDot")
                .data(function(attrib) { return attrib.items; }, function(attrib){ return attrib.id(); })
                // calling order will make sure selected ones appear on top of unselected ones.
                .order()
                ;
            // TODO: call order only on this row
            // re-calculate min-max only on this row
            // etc...
        },this);

        // update min-max time extents ber timeBar
        this.updateAttrib_TimeMinMax();
        if(this.dom.timeBarActive){
            this.dom.timeBarActive
                .style("left", function(d) {
                    return ((me.timeScale(d.xMin_Dyn===undefined?d.xMin:d.xMin_Dyn))+5)+"px";
                })
                .style("width", function (d) { 
                    if(d.xMin_Dyn===undefined){ return "0px"; }
                    return (me.timeScale(d.xMax_Dyn) - me.timeScale(d.xMin_Dyn))+"px";
                })
                ;
        }
        rows.forEach(function(row){row.sortDirty=false;});
    },
    /** -- */
    insertTimeChartRows: function(){
    	var me = this;
        var kshf_ = this.getKshf();

        // scrollbar filler
        this.dom.attribs.append("span").attr("class","scrollbarFiller")
            .style("width",(kshf_.scrollWidth+kshf_.sepWidth-10)+"px"); // -5 if for allowing overflow hidden of timedots

        // Create helper line
        this.dom.row_bar_line = this.dom.barGroup.insert("span",":first-child").attr("class", "row_bar_line");

        this.dom.timeLineParts = this.dom.attribs.append("span").attr("class","timeLineParts");
        if(this.options.timeBarShow===true){
            this.dom.timeLineParts.append("span").attr("class","bar timeBar total" );
            this.dom.timeLineParts.append("span").attr("class","bar timeBar active");
        }
    	// Create bar dots
    	this.dom.timeLineParts.selectAll("span.timeDot")
    		.data(function(attrib){ return attrib.items; }, 
                  function(item){ return item.id(); })
    		.enter().append("span")
    		.attr("class", function(item) {
                if(me.options.dotClassFunc){ return "timeDot " + me.options.dotClassFunc(item); }
                return "timeDot";
            })
            .attr("highlight","false")
            .each(function(item){ item.mappedDotDOMs.push(this); })
            .on("mouseover",function(item,i,f){
                item.highlightAll();
                // update the position of selectVertLine
                me.dom.selectVertLine
                    .style("left",( me.getWidth_Left()+me.timeScale(me.options.timeItemMap(item))+7)+"px")
                    .style("display","block");
                d3.event.stopPropagation();
            })
            .on("mouseout",function(item,i){
                item.nohighlightAll();
                me.dom.selectVertLine.style("display","none");
                d3.event.stopPropagation();
            })
    		.on("click", function(item,i,f) {
                var itemDate = item.mappedData[me.timeFilter.id];
                var rangeMin = new Date(itemDate);
                var rangeMax = new Date(itemDate);

                if(me.timeticks.range === d3.time.months){
                    rangeMin.setDate(rangeMin.getDate()-15);
                    rangeMax = new Date(rangeMin);
                    rangeMax.setMonth(rangeMin.getMonth()+1);
                }
                if(me.timeticks.range === d3.time.years){
                    // if zoomed years range is wide, use 5-year step size
                    var diff_Year =  new Date(me.timeZoom_ms.max).getFullYear() - new Date(me.timeZoom_ms.min).getFullYear();
                    if(me.options.timeMaxWidth<diff_Year*10){
                        rangeMin.setFullYear(rangeMin.getFullYear()-5);
                        rangeMax.setFullYear(rangeMax.getFullYear()+5);
                    } else {
                        rangeMin.setMonth(rangeMin.getMonth()-6);
                        rangeMax = new Date(rangeMin);
                        rangeMax.setMonth(rangeMin.getMonth()+12);
                    }
                }
                if(me.timeticks.range === d3.time.days){
                    rangeMin.setDate(rangeMin.getDate()-1);
                    rangeMax.setDate(rangeMin.getDate()+1);
                }

                me.timeFilter_ms.min = Date.parse(rangeMin);
                me.timeFilter_ms.max = Date.parse(rangeMax);

                me.yearSetXPos();
                me.updateItemFilterState_Time();
                me.timeFilter.addFilter(false);
                // kshf_.update is done by attribute filtering called below.

                // filter for selected attribute
                me.unselectAllAttribs();
                me.filterAttrib( d3.select(this.parentNode.parentNode).datum() );

                if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.TimeDot,kshf_.getFilteringState());

                d3.event.stopPropagation();
    		})
            ;
        this.dom.timeBar       = this.dom.timeLineParts.selectAll('span.timeBar')
        this.dom.timeBarActive = this.dom.timeLineParts.selectAll("span.timeBar.active");
        this.dom.timeBarTotal  = this.dom.timeLineParts.selectAll("span.timeBar.total");
        this.dom.timeDots      = this.dom.timeLineParts.selectAll('span.timeDot');
    },
    /** -- */
    setTimeTicks: function(){
        this.timeticks = {};

        // http://stackoverflow.com/questions/3224834/get-difference-between-2-dates-in-javascript/15289883#15289883
        var _MS_PER_DAY = 1000 * 60 * 60 * 24;
        var _MS_PER_MONTH = _MS_PER_DAY * 30.4; // assuming 30.4 days per month - 365/12
        var _MS_PER_YEAR = _MS_PER_DAY * 365;

        var timeZoom_msDiff;
        if(this.timeZoom_ms!==undefined) {
            timeZoom_msDiff= this.timeZoom_ms.max - this.timeZoom_ms.min;
        } else {
            timeZoom_msDiff = this.timeData_dt.max.getTime() - this.timeData_dt.min.getTime();
        }

        var diff_Day = Math.floor(timeZoom_msDiff / _MS_PER_DAY);
        var diff_Month =  Math.floor(timeZoom_msDiff / _MS_PER_MONTH );
        var diff_Year= Math.floor(timeZoom_msDiff / _MS_PER_YEAR );

        // this.options.timeMaxWidth is the current timeline width
        var timeWidthSteps = this.options.timeMaxWidth/70;

        // choose range
        if(timeWidthSteps<=diff_Year){
            // YEAR
            this.timeticks.range = d3.time.years;
            this.timeticks.format = d3.time.format.utc("%Y");
            this.timeticks.stepSize = Math.ceil(diff_Year/(this.options.timeMaxWidth/30));
        } else if(timeWidthSteps<=diff_Month){
            // MONTH
            this.timeticks.range = d3.time.months;
            this.timeticks.format = d3.time.format.utc("%b '%y");
            this.timeticks.stepSize = Math.ceil(diff_Month/(this.options.timeMaxWidth/60));
            // must be 1/2/3/4/6/12
            if(this.timeticks.stepSize>12) { this.timeticks.stepSize = 12;}
            else if(this.timeticks.stepSize>6){ this.timeticks.stepSize = 6;}
            else if(this.timeticks.stepSize>4) {this.timeticks.stepSize = 4;}
        } else if(true){
            // DAY
            this.timeticks.range = d3.time.days;
            this.timeticks.format = d3.time.format.utc("%e %b"); // 17Feb
            this.timeticks.stepSize = Math.ceil(diff_Day/timeWidthSteps/2);
            // 16/11/8/7/5.5/5
            if(this.timeticks.stepSize>16) { this.timeticks.stepSize = 32;}
            else if(this.timeticks.stepSize>10){ this.timeticks.stepSize = 15;}
            else if(this.timeticks.stepSize>5) {this.timeticks.stepSize = 10;}
            this.timeticks.stepSize++;
        }

        if(this.useCurrentTimeMinMax===undefined){
            var tempDate;
            if(this.timeticks.range===d3.time.years){
                this.timeRange_ms = { 
                    min: Date.UTC(this.timeData_dt.min.getUTCFullYear(),0,1),
                    max: Date.UTC(this.timeData_dt.max.getUTCFullYear()+1,0,1)};
            } else if(this.timeticks.range===d3.time.months){
                this.timeRange_ms = {
                    min: Date.UTC(this.timeData_dt.min.getUTCFullYear(),this.timeData_dt.min.getUTCMonth(),1),
                    max: Date.UTC(this.timeData_dt.max.getUTCFullYear(),this.timeData_dt.max.getUTCMonth()+1,1)};
            } else if(this.timeticks.range===d3.time.days){
                this.timeRange_ms = {
                    min: Date.UTC(this.timeData_dt.min.getUTCFullYear(),this.timeData_dt.min.getUTCMonth(),this.timeData_dt.min.getUTCDate()-1),
                    max: Date.UTC(this.timeData_dt.max.getUTCFullYear(),this.timeData_dt.max.getUTCMonth(),this.timeData_dt.max.getUTCDate()+1)};
            }

            this.resetTimeZoom_ms();
            this.resetTimeFilter_ms();
        }
        // update the time scale with the new date domain
        this.updateTimeScale();
    },
    /** -- */
    updateTimeScale: function(){
        this.timeScale = d3.time.scale.utc()
            .domain([new Date(this.timeZoom_ms.min), new Date(this.timeZoom_ms.max)])
            .rangeRound([0, this.options.timeMaxWidth])
            ;
    },
    /** -- */
    insertTimeTicks: function(){
        var me = this;

        var xAxis = d3.svg.axis()
            .scale(this.timeScale)
            .orient('bottom')
            .innerTickSize(6)
            .outerTickSize(1)
            .ticks(this.timeticks.range, this.timeticks.stepSize ) // d3.time.years, 2 , no tickValues
            .tickFormat(this.timeticks.format ) // d3.time.format("%Y")
            ;
        ;
        this.dom.tickGroup.call(xAxis);

        this.insertTimeTicks_timeValues = [];

        this.dom.tickGroup.selectAll("text")
            .each(function(d,i){
                me.insertTimeTicks_timeValues.push(d);
            })
            .on("click",function(d,i){
                var curTime  = me.insertTimeTicks_timeValues[i];
                var nextTime = me.insertTimeTicks_timeValues[i+1];
                if(nextTime === undefined){
                    nextTime = me.timeRange_ms.max;
                }
                me.timeFilter_ms = {min: curTime, max: nextTime};
                me.yearSetXPos();
                me.updateItemFilterState_Time();
                me.timeFilter.addFilter(true);
            })
            ;

        this.dom.tickGroup.selectAll(".tick.major text").style("text-anchor","middle");
    },
    /** -- */
    insertTimeChartAxis_1: function(){
        var ggg = this.dom.timeAxisGroup.append("g").attr("class","selection_bar")  ;
        ggg.append("title").attr("class","xaxis_title");
        ggg.append("rect").attr("y",0).attr("height", 6)

        var axisSubGroup=this.dom.timeAxisGroup.selectAll(".filter_handle")
            .data([1,2])
            .enter()
            .append("g")
            .attr("class", function(d,i) { return "filter_handle "+((i===0)?"filter_min":"filter_max"); })
            ;
        axisSubGroup
            .append("line")
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", this.getKshf().line_height*1.5-4)
            ;
        axisSubGroup
            .append("rect")
            .attr("class", "filter_nonselected")
            .attr("y",0)
            .attr("height",0)
            .on("click",function(){ d3.event.stopPropagation(); })
            ;

        var axisSubGroup=this.dom.timeAxisGroup.selectAll(".filter_handle");
        
        var axisSubSubGroup = axisSubGroup.append("g");
        axisSubSubGroup.append("title").attr("class","xaxis_title");
        axisSubSubGroup
            .append("path")
            .attr("transform",function(d,i) { return "translate("+(i===0?"0":"0")+",-9)";})
            .attr("d", function(d,i) { 
                return (i===0)?"M0 6 L0 16 L9 6 Z":"M0 6 L0 16 L-9 6 Z";
            })
    },
	/** -- */
    insertTimeChartAxis: function(){
        var me=this;
        var kshf_ = this.getKshf();

        var axisGroup = this.dom.timeAxisGroup;
        var msPerTick;
        switch(this.timeticks.range){
            case d3.time.years:
                msPerTick = 31557600000; break;
            case d3.time.months:
                msPerTick = 31557600000/12; break;
            case d3.time.days:
                msPerTick = 31557600000/(12*30); break;
            default: break;
        }
        this.lengthPerTick = msPerTick*this.timeScale.range()[1]/
            (this.timeZoom_ms.max-this.timeZoom_ms.min);
    	
    	axisGroup.select(".selection_bar rect")
    		.on("mousedown", function(d, i) {
                var eeeeee = this;
                this.style.stroke = "orangered";
                me.divRoot.style('cursor','pointer');
                var mouseDown_x = d3.mouse(axisGroup[0][0])[0];
                var mousedown_filter = {
                    min: me.timeFilter_ms.min,
                    max: me.timeFilter_ms.max
                };
    			var timeFilter_ms = me.timeFilter_ms;
                var olddif=null;
    			me.divRoot.on("mousemove", function() {
    				var mouseMove_x = d3.mouse(axisGroup[0][0])[0];
    				var mouseDif = mouseMove_x-mouseDown_x;
    				var mousemove_filter = timeFilter_ms.min;
    				var stepDif = Math.round(mouseDif/me.lengthPerTick)*msPerTick;
    				if(stepDif===olddif ) { return; }
                    olddif=stepDif;
    				if(stepDif<0){
    					timeFilter_ms.min = mousedown_filter.min+stepDif;
    					if(timeFilter_ms.min<me.timeZoom_ms.min){
    						timeFilter_ms.min=me.timeZoom_ms.min;
    					}
    					timeFilter_ms.max=timeFilter_ms.min+(mousedown_filter.max-mousedown_filter.min);
    				} else {
    					timeFilter_ms.max = mousedown_filter.max+stepDif;
    					if(timeFilter_ms.max>me.timeZoom_ms.max){
    						timeFilter_ms.max=me.timeZoom_ms.max;
    					}
    					timeFilter_ms.min=timeFilter_ms.max-(mousedown_filter.max-mousedown_filter.min);
    				}
    				// TODO: make sure you don't exceed the boundaries
    				if(mousemove_filter.min!==timeFilter_ms.min){
                        kshf_.anim_barscale_duration = 0;
    					// update filter 
    					me.yearSetXPos();
                        me.updateItemFilterState_Time();
                        me.timeFilter.addFilter(true);
    				}
    			}).on("mouseup", function(){
                    eeeeee.style.stroke= "";
                    me.divRoot.style( 'cursor', 'default' );
                    me.x_axis_active_filter = null;
                    // unregister mouse-move callbacks
                    me.divRoot.on("mousemove", null).on("mouseup", null);
                    me.refreshTimeChartDotConfig();
                    if(sendLog) sendLog(CATID.FacetFilter,ACTID_FILTER.TimeDragRange,kshf_.getFilteringState());
    			});
    		});
    	
    	// Filter handles
    	axisGroup.selectAll(".filter_handle g path")
    		.on("mousedown", function(d, i) {
                var eeeee = this;
    			me.x_axis_active_filter = (i===0)?'min':'max';
                this.style.stroke = 'orangered';
                me.divRoot.style('cursor','pointer');
    			var timeFilter_ms = me.timeFilter_ms; // shorthand
    			me.divRoot.on("mousemove", function() {
    				var mouseMove_x = d3.mouse(axisGroup[0][0])[0];

                    // convert mouse position to date
                    var time_ms = Math.floor(
                        me.timeZoom_ms.min+ 
                        (me.timeZoom_ms.max-me.timeZoom_ms.min)*(mouseMove_x / me.options.timeMaxWidth)
                        );

                    var time_dt = new Date(time_ms);

                    var time_ = null;
                    if(me.timeticks.range===d3.time.years){
                        time_ = kshf.Util.nearestYear(time_dt);
                    } else if(me.timeticks.range===d3.time.months){
                        time_ = kshf.Util.nearestMonth(time_dt);
                    } else if(me.timeticks.range===d3.time.days){
                        time_ = kshf.Util.nearestDay(time_dt);
                    }

                    // if it has the same value after mouse is moved, don't update any filter
                    if(timeFilter_ms[me.x_axis_active_filter] === time_.getTime()) return;
                    // update timeFilter_ms
                    timeFilter_ms[me.x_axis_active_filter] = time_.getTime();
                    
                    // Check agains min/max order, sawp if necessary
                    if(timeFilter_ms.max<timeFilter_ms.min){
                        eeeee.style.stroke = "";
                        me.x_axis_active_filter = (me.x_axis_active_filter==='min'?'max':'min');
                        var tttt= timeFilter_ms.max;
                        timeFilter_ms.max = timeFilter_ms.min;
                        timeFilter_ms.min = tttt;
                    }

                    // update filter 
                    kshf_.anim_barscale_duration = 0;
                    me.yearSetXPos();
                    me.updateItemFilterState_Time();
                    me.timeFilter.addFilter(true);
                    
                    if(me.sortingOpt_Active.no_resort!==true) me.divRoot.attr("canResort",true);
    			}).on("mouseup", function(){
                    eeeee.style.stroke = "";
    				me.divRoot.style('cursor','default');
    				me.x_axis_active_filter = null;
    				me.divRoot.on("mousemove", null).on("mouseup", null);

                    me.refreshTimeChartDotConfig();
                    if(sendLog) {
                        if(me.x_axis_active_filter==="min")
                            sendLog(CATID.FacetFilter,ACTID_FILTER.TimeMinHandle,kshf_.getFilteringState());
                        else
                            sendLog(CATID.FacetFilter,ACTID_FILTER.TimeMaxHandle,kshf_.getFilteringState());
                    }
    			});
    		});
        this.yearSetXPos();
    },
    /** -- */
    updateTimeChartBarsDots: function(){
        var kshf_ = this.getKshf();
        var totalLeftWidth = kshf_.getWidth_LeftPanel()+kshf_.sepWidth;
    	var me = this;
        var timeFilterId = this.timeFilter.id;
        this.dom.timeBarTotal
            .style("left",  function(d){ return (me.timeScale(d.xMin))+"px"; })
            .style("width", function(d){ return (me.timeScale(d.xMax) - me.timeScale(d.xMin))+"px"; })
            ;
    	this.dom.timeDots
            .each(function(item){
                var str="translateX("+(me.timeScale(item.mappedData[timeFilterId])-5+5)+"px)";
                this.style.webkitTransform = str;
                this.style.MozTransform = str;
                this.style.msTransform = str;
                this.style.OTransform = str;
                this.style.transform = str;
            });
        this.dom.timeLineParts
            .style("width", (this.options.timeMaxWidth+13)+"px")
    },
    /** -- */
    getFilterMinDateText: function(){
        var dt = new Date(this.timeFilter_ms.min);
        return this.timeticks.format(dt);
    },
    /** -- */
    getFilterMaxDateText: function(){
        var dt = new Date(this.timeFilter_ms.max);
        return this.timeticks.format(dt);
    },
    /** -- */
    yearSetXPos: function() {
        var kshf_ = this.getKshf();
        // make sure filtered range do not exceed domain range
        this.timeFilter_ms.min = Math.max(this.timeFilter_ms.min,this.timeZoom_ms.min);
        this.timeFilter_ms.max = Math.min(this.timeFilter_ms.max,this.timeZoom_ms.max);

        if(this.timeFilter_ms.min>this.timeFilter_ms.max){
            var tmp = this.timeFilter_ms.min;
            this.timeFilter_ms = {
                min: this.timeFilter_ms.max,
                max: tmp};
        }

    	var minX = this.timeScale(this.timeFilter_ms.min);
    	var maxX = this.timeScale(this.timeFilter_ms.max);

        if(this.options.timeMaxWidth-minX>190){
            this.divRoot.select(".config_zoom")
                .style("float","left")
                .style("margin-left",minX+"px");
        } else{
            this.divRoot.select(".config_zoom")
                .style("float","right")
                ;
        }
    	
    	this.dom.timeAxisGroup.select("g.filter_min")
            .attr("filtered",this.timeFilter_ms.min!==this.timeRange_ms.min)
            .transition().duration(kshf_.anim_barscale_duration)
    		.attr("transform", "translate("+minX+",0)" );
    	this.dom.timeAxisGroup.select("g.filter_max")
            .attr("filtered",this.timeFilter_ms.max!==this.timeRange_ms.max)
            .transition().duration(kshf_.anim_barscale_duration)
    		.attr("transform", "translate("+maxX+",0)" );
    	this.dom.timeAxisGroup.select(".selection_bar rect")
            .transition().duration(kshf_.anim_barscale_duration)
    		.attr("x", minX)
    		.attr("width", (maxX - minX));
    	this.dom.timeAxisGroup.select("g.filter_min .filter_nonselected")
            .transition().duration(kshf_.anim_barscale_duration)
    		.attr("x", -minX)
    		.attr("width", minX);
    	this.dom.timeAxisGroup.select("g.filter_max .filter_nonselected")
            .transition().duration(kshf_.anim_barscale_duration)
    		.attr("x", 0)
    		.attr("width", this.options.timeMaxWidth-maxX);
        this.divRoot.attr("filtered_time",this.isFiltered_Time()?"true":"false");
        
        this.divRoot.select(".zoom_in").attr("disabled",this.isFiltered_Time()?"false":"true");
    },
    text_item_Time: function(){
        return "from <b>"+this.getFilterMinDateText()+"</b> to <b>"+this.getFilterMaxDateText()+"</b>";
    },
};


