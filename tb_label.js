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
        for (idx in message.flags.tb_labels) {
          // TODO escape
          spanobj.append("<span class='label'>"+message.flags.tb_labels[idx]+"</span>");
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
          if (rcmail.env.tb_label_style=='bullets') {
            $('#labelbox').append("<span class='tb_label_span tb_label_span"+toggle_label+"'>" +
                // TODO escape
                toggle_label + "</span>");
          } else {
            headers_table.addClass('label'+toggle_label);
          }
            // add to flag list
            tb_labels_for_message.push(toggle_label);

        }
        else
        {
            if (rcmail.env.tb_label_style=='bullets') {
              $("span.tb_label_span"+toggle_label).remove();
            } else {
              headers_table.removeClass('label'+toggle_label);
            }

            var pos = jQuery.inArray(toggle_label, tb_labels_for_message);
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
                if (rcmail.env.tb_label_style=='bullets') {
                  // TODO escape
                  spanobj.append("<span class='label"+toggle_label+"'>"+toggle_label+"</span>");
                } else {
                  rowobj.addClass('label'+toggle_label);
                }

                // add to flag list
                message.flags.tb_labels.push(toggle_label);
            }
            else
            {
                // remove colors
                var rowobj = $(row.obj);
                if (rcmail.env.tb_label_style=='bullets') {
                  rowobj.find("td.subject span.tb_label_dots span.label"+toggle_label).remove();
                } else {
                  rowobj.removeClass('label'+toggle_label);
                }

                // remove from flag list
                var pos = jQuery.inArray(toggle_label, message.flags.tb_labels);
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
            // show/hide checkmark
            var message = rcmail.env.messages[sel];
            // we can expect message.flags.tb_labels to be all uppercase
            if (message.flags && message.flags.tb_labels) {
                var lbl = cur_e.attr('data-label').toUpperCase();
                if (message.flags.tb_labels.indexOf(lbl) >= 0) {
                    show_label = true;
                    return false;
                }
            }
        });

        // now apply the checkmarks for real
        if (show_label)
            cur_e.find('.checkmark').show();
        else
            cur_e.find('.checkmark').hide();
    });
}

function rcm_tb_label_init_onclick()
{
    for (i = 0; i < 6; i++)
    {
      // find the "HTML a tags" of tb-label submenus
        var cur_a = $('#tb_label_popup li.label' + i +' a');

        // TODO check if click event is defined instead of unbinding?
        cur_a.unbind('click');
        cur_a.click(function() {
                var toggle_label = $(this).parent().attr('class');
                var toggle_label_no = parseInt(toggle_label.replace('label', ''));
                var selection = rcm_tb_label_get_selection();

                if (!selection.length)
                    return;

                var from = toggle_label_no;
                var to = toggle_label_no + 1;
                var unset_all = false;
                // special case flag 0 means remove all flags
                if (toggle_label_no == 0)
                {
                    from = 1;
                    to = 6;
                    unset_all = true;
                }
                for (i = from; i < to; i++)
                {
                    toggle_label = 'label' + i;
                    toggle_label_no = i;
                    // compile list of unflag and flag msgs and then send command
                    // Thunderbird modifies multiple message flags like it did the first in the selection
                    // e.g. first message has flag1, you click flag1, every message select loses flag1, the ones not having flag1 don't get it!
                    var first_toggle_mode = 'on';
                    if (rcmail.env.messages)
                    {
                        var first_message = rcmail.env.messages[selection[0]];
                        if (first_message.flags
                            && jQuery.inArray(toggle_label_no,
                                    first_message.flags.tb_labels) >= 0
                            )
                            first_toggle_mode = 'off';
                        else
                            first_toggle_mode = 'on';
                    }
                    else // single message display
                    {
                        // flag already set?
                        if (jQuery.inArray(toggle_label_no,
                                    tb_labels_for_message) >= 0)
                            first_toggle_mode = 'off';
                    }
                    var flag_uids = [];
                    var unflag_uids = [];
                    jQuery.each(selection, function (idx, uid) {
                            // message list not available (example: in detailview)
                            if (!rcmail.env.messages)
                            {
                                if (first_toggle_mode == 'on')
                                    flag_uids.push(uid);
                                else
                                    unflag_uids.push(uid);
                                // make sure for unset all there is the single message id
                                if (unset_all && unflag_uids.length == 0)
                                    unflag_uids.push(uid);
                                return;
                            }
                            var message = rcmail.env.messages[uid];
                            if (message.flags
                                && jQuery.inArray(toggle_label_no,
                                        message.flags.tb_labels) >= 0
                                )
                            {
                                if (first_toggle_mode == 'off')
                                    unflag_uids.push(uid);
                            }
                            else
                            {
                                if (first_toggle_mode == 'on')
                                    flag_uids.push(uid);
                            }
                    });

                    if (unset_all)
                        flag_uids = [];

                    // skip sending flags to backend that are not set anywhere
                    if (flag_uids.length == 0
                        && unflag_uids.length == 0)
                            continue;

                    var str_flag_uids = flag_uids.join(',');
                    var str_unflag_uids = unflag_uids.join(',');

                    var lock = rcmail.set_busy(true, 'loading');
                    // call PHP set_flags to set the flags in IMAP server
                    console.log(str_flag_uids);
                    console.log(str_unflag_uids);
                    //rcmail.http_request('plugin.labels.set_flags', '_flag_uids=' + str_flag_uids + '&_unflag_uids=' + str_unflag_uids + '&_mbox=' + urlencode(rcmail.env.mailbox) + "&_toggle_label=" + toggle_label, lock);

                    // remove/add classes and tb labels from messages in JS
                    rcm_tb_label_flag_msgs(flag_uids, toggle_label_no);
                    rcm_tb_label_unflag_msgs(unflag_uids, toggle_label_no);
                }
        });
    }
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
                rcm_tb_label_flag_msgs([-1,], val);
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

