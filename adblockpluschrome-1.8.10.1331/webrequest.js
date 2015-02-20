/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2015 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

var FilterNotifier = require("filterNotifier").FilterNotifier;
var platform = require("info").platform;

var onFilterChangeTimeout = null;
function onFilterChange()
{
  onFilterChangeTimeout = null;
  ext.webRequest.handlerBehaviorChanged();
}

var importantNotifications = {
  'filter.added': true,
  'filter.removed': true,
  'filter.disabled': true,
  'subscription.added': true,
  'subscription.removed': true,
  'subscription.disabled': true,
  'subscription.updated': true,
  'load': true
};

FilterNotifier.addListener(function(action)
{
  if (action in importantNotifications)
  {
    // Execute delayed to prevent multiple executions in a quick succession
    if (onFilterChangeTimeout != null)
      window.clearTimeout(onFilterChangeTimeout);
    onFilterChangeTimeout = window.setTimeout(onFilterChange, 2000);
  }
});

function onBeforeRequest(url, type, page, frame)
{
  if (isFrameWhitelisted(page, frame))
    return true;
  
  console.log(arguments);

  var docDomain = extractHostFromFrame(frame);
  var key = getKey(page, frame);

  var filter = defaultMatcher.matchesAny(
    stringifyURL(url),
    type == "sub_frame" ? "SUBDOCUMENT" : type.toUpperCase(),
    docDomain,
    isThirdParty(url, docDomain),
    key
  );

  console.log(defaultMatcher);



  if(filter && filter instanceof BlockingFilter){
     console.log(stringifyURL(url));
  console.log(type);
  console.log(docDomain);
  console.log(isThirdParty(url, docDomain));
  console.log(key);
  console.log("-------------------");

   /* console.groupCollapsed("Element blocked!");
    console.log(filter.subscriptions[0]._title + " : blocked " + type);
    console.log(" from magic string " + filter.text);
    console.log(" and regexp" +filter.regexp.source);
    console.groupEnd();*/
  }

  // We can't listen to onHeadersReceived in Safari so we need to
  // check for notifications here
  if (platform != "chromium" && type == "sub_frame")
  {
    var notificationToShow = NotificationStorage.getNextToShow(stringifyURL(url));
    if (notificationToShow)
      showNotification(notificationToShow);
  }

  FilterNotifier.triggerListeners("filter.hitCount", filter, 0, 0, page);
  return !(filter instanceof BlockingFilter);
}

ext.webRequest.onBeforeRequest.addListener(onBeforeRequest);

if (platform == "chromium")
{
  function onHeadersReceived(details)
  {
    if (details.tabId == -1)
      return;

    if (details.type != "main_frame" && details.type != "sub_frame")
      return;

    var page = new ext.Page({id: details.tabId});
    var frame = ext.getFrame(details.tabId, details.frameId);

    if (!frame || frame.url.href != details.url)
      return;

    for (var i = 0; i < details.responseHeaders.length; i++)
    {
      var header = details.responseHeaders[i];
      if (header.name.toLowerCase() == "x-adblock-key" && header.value)
        processKey(header.value, page, frame);
    }

    var notificationToShow = NotificationStorage.getNextToShow(stringifyURL(new URL(details.url)));
    if (notificationToShow)
      showNotification(notificationToShow);
  }

  chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["http://*/*", "https://*/*"]}, ["responseHeaders"]);
}
