/**
 * Version:
 * $Revision$
 * Author:
 * Michael Kefeder
 * http://code.google.com/p/rcmail-thunderbird-labels/
 */

/**
* Shows the colors based on flag info like in Thunderbird
* (called when a new message in inserted in list of messages)
* maybe slow ? called for each message in mailbox at init
*/
function rcm_tb_label_insert(uid, row)
{
    if (typeof rcmail.env == 'undefined' || typeof rcmail.env.messages == 'undefined')
        return;
    var message = rcmail.env.messages[uid];
    var rowobj = $(row.obj);
    // add span container for little colored bullets
    rowobj.find("td.subject").append("<span class='tb_label_dots'></span>");

    if (message.flags && message.flags.tb_labels) {
      if (message.flags.tb_labels.length) {
        var spanobj = rowobj.find("td.subject span.tb_label_dots");
        message.flags.tb_labels.sort(function(a,b) {return a-b;});
        for (var idx in message.flags.tb_labels) {
          var label_span = $("<span class='label'></span>");
          label_span.text(message.flags.tb_labels[idx]);
          spanobj.append(label_span);
        }
      }
    }
}

/**
* Shows the submenu of thunderbird labels
*/
function rcm_tb_label_submenu(p)
{
    if (typeof rcmail_ui == "undefined")
        rcmail_ui = UI;
    // setup onclick and active/non active classes
    rcm_tb_label_create_popupmenu();

    // -- create sensible popup, using roundcubes internals
    if (!rcmail_ui.check_tb_popup())
        rcmail_ui.tb_label_popup_add();

    // -- skin larry vs classic
    if (typeof rcmail_ui.show_popupmenu == "undefined")
        rcmail_ui.show_popup('tb_label_popup');
    else
        rcmail_ui.show_popupmenu('tb_label_popup');
    return false;
}

function rcm_tb_label_flag_toggle(flag_uids, toggle_label, onoff)
{
    var headers_table = $('table.headers-table');
    var preview_frame = $('#messagecontframe');
    // preview frame exists, simulate environment of single message view
    if (preview_frame.length)
    {
        tb_labels_for_message = preview_frame.get(0).contentWindow.tb_labels_for_message;
        headers_table = preview_frame.contents().find('table.headers-table');
    }

    if (!rcmail.message_list
        && !headers_table)
        return;
    // for single message view
    if (headers_table.length && flag_uids.length) {
        if (onoff == true) {
            var label_span = $("<span class='tb_label_span'></span>");
            label_span.addClass("tb_label_span"+toggle_label);
            label_span.text(toggle_label);

            $('#labelbox').append(label_span);
            // add to flag list
            var pos = jQuery.inArray(toggle_label.toLowerCase(), lowercase_all(tb_labels_for_message));
            if (pos < 0) {
                tb_labels_for_message.push(toggle_label);
            }
        }
        else
        {
            $("span.tb_label_span"+toggle_label).remove();

            var pos = jQuery.inArray(toggle_label.toLowerCase(), lowercase_all(tb_labels_for_message));
            if (pos > -1) {
                tb_labels_for_message.splice(pos, 1);
            }
        }
        // exit function when in detail mode. when preview is active keep going
        if (!rcmail.env.messages) {
            return;
        }
    }
    jQuery.each(flag_uids, function (idx, uid) {
            var message = rcmail.env.messages[uid];
            var row = rcmail.message_list.rows[uid];
            if (onoff == true)
            {
                // add colors
                var rowobj = $(row.obj);
                var spanobj = rowobj.find("td.subject span.tb_label_dots");
                var label_span = $("<span></span>");
                label_span.addClass("label"+toggle_label);
                label_span.text(toggle_label);
                spanobj.append(label_span);

                // add to flag list
                message.flags.tb_labels.push(toggle_label);
            }
            else
            {
                // remove colors
                var rowobj = $(row.obj);
                rowobj.find("td.subject span.tb_label_dots span.label"+toggle_label).remove();

                // remove from flag list
                var pos = jQuery.inArray(toggle_label.toLowerCase(), lowercase_all(message.flags.tb_labels));
                if (pos > -1)
                    message.flags.tb_labels.splice(pos, 1);
            }
    });
}

function rcm_tb_label_flag_msgs(flag_uids, toggle_label)
{
    rcm_tb_label_flag_toggle(flag_uids, toggle_label, true);
}

function rcm_tb_label_unflag_msgs(unflag_uids, toggle_label)
{
    rcm_tb_label_flag_toggle(unflag_uids, toggle_label, false);
}

// helper function to get selected/active messages
function rcm_tb_label_get_selection()
{
    var selection = rcmail.message_list ? rcmail.message_list.get_selection() : [];
    if (selection.length == 0 && rcmail.env.uid)
        selection = [rcmail.env.uid, ];
    return selection;
}

function lowercase_all(list)
{
    return list.map(function(elem) { return elem.toLowerCase(); });
}

function rcm_tb_label_create_popupmenu()
{
    $('#tb_label_popup li').each(function(i, e) {
        var cur_e = $(e);
        var cur_a = cur_e.find('a');

        // add/remove active class
        var selection = rcm_tb_label_get_selection();

        if (selection.length == 0)
            cur_a.removeClass('active');
        else
            cur_a.addClass('active');

        // if at least one message has the label, we got it
        var show_label = false;
        jQuery.each(selection, function(i, sel) {
            var message_flags;
            if (rcmail.env.messages) {
                var message = rcmail.env.messages[sel];
                message_flags = message.flags.tb_labels;
            }
            else {
                message_flags = tb_labels_for_message;
            }

            message_flags = lowercase_all(message_flags);
            // show/hide checkmark
            var lbl = cur_e.data('label').toLowerCase();
            if (message_flags.indexOf(lbl) >= 0) {
                show_label = true;
                return false;
            }
        });

        // now apply the checkmarks for real
        if (show_label) {
            cur_e.find('.checkmark').show();
        }
        else {
            cur_e.find('.checkmark').hide();
        }
    });
}

function rcm_tb_label_init_onclick()
{
    $('#tb_label_popup li').each(function(i, e) {
        // find the "HTML a tags" of tb-label submenus
        var cur_a = $(e).find('a');

        // TODO check if click event is defined instead of unbinding?
        cur_a.unbind('click');
        cur_a.click(function() {
            var selection = rcm_tb_label_get_selection();
            if (!selection.length)
                return;

            var label_obj = $(this).parent();
            var toggle_label = label_obj.data('label');

            var toggle_mode = 'off';
            if (rcmail.env.messages)
            {
                // policy is: flag all if at least one is not flagged, otherwise unflag all
                jQuery.each(selection, function (idx, uid) {
                    var message = rcmail.env.messages[uid];
                    if (message.flags &&
                        jQuery.inArray(toggle_label.toLowerCase(), lowercase_all(message.flags.tb_labels)) < 0) {
                        toggle_mode = 'on';
                        return false;
                    }
                });
            }
            else // single message display
            {
                // flag already set?
                if (jQuery.inArray(toggle_label.toLowerCase(),
                        lowercase_all(tb_labels_for_message)) < 0)
                    toggle_mode = 'on';
            }

            var flag_uids = [];
            var unflag_uids = [];
            jQuery.each(selection, function (idx, uid) {
                // message list not available (example: in detailview)
                if (!rcmail.env.messages)
                {
                    if (toggle_mode == 'on')
                        flag_uids.push(uid);
                    else
                        unflag_uids.push(uid);
                }
                // in message list
                else {
                    var message = rcmail.env.messages[uid];
                    if (message.flags
                        && jQuery.inArray(toggle_label.toLowerCase(),
                            lowercase_all(message.flags.tb_labels)) >= 0
                    ) {
                        if (toggle_mode == 'off')
                            unflag_uids.push(uid);
                    }
                    else {
                        if (toggle_mode == 'on')
                            flag_uids.push(uid);
                    }
                }
            });

            var str_flag_uids = flag_uids.join(',');
            var str_unflag_uids = unflag_uids.join(',');

            var lock = rcmail.set_busy(true, 'loading');
            // call PHP set_flags to set the flags in IMAP server
            rcmail.http_request('plugin.labels.set_flags', '_flag_uids=' + str_flag_uids + '&_unflag_uids=' + str_unflag_uids + '&_mbox=' + urlencode(rcmail.env.mailbox) + "&_toggle_label=" + toggle_label, lock);

            // remove/add classes and tb labels from messages in JS
            var label_text = label_obj.find('.label-text').text();
            rcm_tb_label_flag_msgs(flag_uids, label_text);
            rcm_tb_label_unflag_msgs(unflag_uids, label_text);
        });
    });
}

$(document).ready(function() {
    rcm_tb_label_init_onclick();

    // single message displayed?
    if (window.tb_labels_for_message)
    {
      var labelbox_parent = $('div.message-headers'); // larry skin
      if (!labelbox_parent.length) {
          labelbox_parent = $("table.headers-table tbody tr:first-child"); // classic skin
      }
      labelbox_parent.append("<div id='labelbox'></div>");
      tb_labels_for_message.sort(function(a,b) {return a-b;});
        jQuery.each(tb_labels_for_message, function(idx, val)
            {
                rcm_tb_label_flag_msgs([-1], val);
            }
        );
    }

    // add roundcube events
    rcmail.addEventListener('insertrow', function(event) { rcm_tb_label_insert(event.uid, event.row); });

    rcmail.addEventListener('init', function(evt) {
        // create custom button, JS method, broken layout in Firefox 9 using PHP method now
        /*var button = $('<A>').attr('href', '#').attr('id', 'tb_label_popuplink').attr('title', rcmail.gettext('label', 'labels')).html('');

        button.bind('click', function(e) {
            rcmail.command('plugin.labels.rcm_tb_label_submenu', this);
            return false;
        });

        // add and register
        rcmail.add_element(button, 'toolbar');
        rcmail.register_button('plugin.labels.rcm_tb_label_submenu', 'tb_label_popuplink', 'link');
        */
        //rcmail.register_command('plugin.labels.rcm_tb_label_submenu', rcm_tb_label_submenu, true);
        rcmail.register_command('plugin.labels.rcm_tb_label_submenu', rcm_tb_label_submenu, rcmail.env.uid);

        // add event-listener to message list
        if (rcmail.message_list) {
            rcmail.message_list.addEventListener('select', function(list){
                rcmail.enable_command('plugin.labels.rcm_tb_label_submenu', list.get_selection().length > 0);
            });
        }
    });

    // -- add my submenu to roundcubes UI (for roundcube classic only?)
    if (window.rcube_mail_ui)
    rcube_mail_ui.prototype.tb_label_popup_add = function() {
        add = {
            tb_label_popup:     {id:'tb_label_popup'}
        };
        this.popups = $.extend(this.popups, add);
        var obj = $('#'+this.popups.tb_label_popup.id);
        if (obj.length)
            this.popups.tb_label_popup.obj = obj;
        else
            delete this.popups.tb_label_popup;
    };

    if (window.rcube_mail_ui)
    rcube_mail_ui.prototype.check_tb_popup = function() {
        // larry skin doesn't have that variable, popup works automagically, return true
        if (typeof this.popups == 'undefined')
            return true;
        if (this.popups.tb_label_popup)
            return true;
        else
            return false;
    };

});

