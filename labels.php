<?php
/**
 * Labels Plugin for Roundcube Webmail
 *
 * Plugin to show IMAP keywords as message labels.
 *
 * @version $Revision$
 * @author Daniele Ricci
 * @author Michael Kefeder
 */
class labels extends rcube_plugin
{
    public $task = 'mail|settings';
    private $rc;
    private $name;
    private $message_tb_labels;
    private $_permflags;

    function init()
    {
        $this->rc = rcmail::get_instance();
        $this->load_config();
        $this->add_texts('localization/', false);

        $this->setCustomLabels();

        if ($this->rc->task == 'mail')
        {
            # -- disable plugin when printing message
            if ($this->rc->action == 'print')
                return;

            $this->include_script('tb_label.js');
            $this->add_hook('messages_list', array($this, 'read_flags'));
            $this->add_hook('message_load', array($this, 'read_single_flags'));
            $this->add_hook('template_object_messageheaders', array($this, 'color_headers'));
            $this->add_hook('render_page', array($this, 'tb_label_popup'));
            $this->add_hook('imap_search_before', array($this, 'exclude_virtual_search'));
            $this->include_stylesheet($this->local_skin_path() . '/tb_label.css');

            $this->name = get_class($this);

            $this->add_button(
                [
                    'command' => 'plugin.labels.rcm_tb_label_submenu',
                    'id' => 'tb_label_popuplink',
                    'title' => 'tb_label_button_title',
                    'domain' => $this->ID,
                    'type' => 'link',
                    'content' => $this->gettext('tb_label_button_label'),
                    'class' => 'button buttonPas disabled',
                    'classact' => 'button',
                ],
                'toolbar'
            );

            // JS function "set_flags" => PHP function "set_flags"
            $this->register_action('plugin.labels.set_flags', [$this, 'set_flags']);
        }
        elseif ($this->rc->task == 'settings')
        {
            $this->include_stylesheet($this->local_skin_path() . '/tb_label.css');
            $this->add_hook('preferences_list', array($this, 'prefs_list'));
            $this->add_hook('preferences_sections_list', array($this, 'prefs_section'));
            $this->add_hook('preferences_save', array($this, 'prefs_save'));
        }
    }

    private function setCustomLabels()
    {
        $c = $this->rc->config->get('tb_label_custom_labels');
        if (empty($c))
        {
            // if no user specific labels, use localized strings by default
            $this->rc->config->set('tb_label_custom_labels', array(
                0 => $this->getText('label0'),
                1 => $this->getText('label1'),
                2 => $this->getText('label2'),
                3 => $this->getText('label3'),
                4 => $this->getText('label4'),
            ));
        }
    }

    // create a section for the labels Settings
    public function prefs_section($args)
    {
        $args['list']['labels'] = array(
                'id' => 'labels',
                'section' => rcube::Q($this->gettext('tb_label_options'))
        );

        return $args;
    }

    // display labels prefs in Roundcube Settings
    public function prefs_list($args)
    {
        if ($args['section'] != 'labels')
            return $args;

        $this->load_config();
        $dont_override = (array) $this->rc->config->get('dont_override', array());

        $args['blocks']['tb_label'] = array();
        $args['blocks']['tb_label']['name'] = $this->gettext('tb_label_options');

        $key = 'tb_label_custom_labels';
        if (!in_array($key, $dont_override))
        {
            $old = $this->rc->config->get($key);
            for($i=0; $i<10; $i++)
            {
                $input = new html_inputfield(array(
                    'name' => $key.$i,
                    'id' => $key.$i,
                    'type' => 'text',
                    'autocomplete' => 'off',
                    'value' => $old[$i]));

                $args['blocks']['tb_label']['options'][$key.$i] = array(
                    'title' => $this->gettext('tb_label_label'),
                    'content' => $input->show()
                    );
            }
        }

        return $args;
    }

    // save prefs after modified in UI
    public function prefs_save($args)
    {
        if ($args['section'] != 'labels')
          return $args;

        $this->load_config();
        $dont_override = (array) $this->rc->config->get('dont_override', array());

        if (!in_array('tb_label_custom_labels', $dont_override))
        {
            $args['prefs']['tb_label_custom_labels'] = [
                rcube_utils::get_input_value('tb_label_custom_labels0', rcube_utils::INPUT_POST),
                rcube_utils::get_input_value('tb_label_custom_labels1', rcube_utils::INPUT_POST),
                rcube_utils::get_input_value('tb_label_custom_labels2', rcube_utils::INPUT_POST),
                rcube_utils::get_input_value('tb_label_custom_labels3', rcube_utils::INPUT_POST),
                rcube_utils::get_input_value('tb_label_custom_labels4', rcube_utils::INPUT_POST),
            ];
        }

        return $args;
    }

    private function in_array_caseins($needle, $haystack)
    {
        return !empty(preg_grep('/^'.preg_quote($needle).'$/i', $haystack));
    }

    /**
     * Builds an array of all labels selectable by the user.
     */
    private function get_user_labels()
    {
        $exclude = $this->rc->config->get('tb_label_exclude');
        $server_flags = $this->get_permflags();
        $custom_labels = $this->rc->config->get('tb_label_custom_labels');
        $labels = [];

        foreach ($server_flags as $flag) {
            if (substr($flag, 0, 1) != '\\' &&
                !$this->in_array_caseins($flag, $exclude)) {
                $labels[strtoupper($flag)] = $flag;
            }
        }

        foreach ($custom_labels as $label) {
            if (!empty($label) && !$this->in_array_caseins($label, $labels)) {
                $labels[strtoupper($label)] = $label;
            }
        }

        return $labels;
    }

    private function get_permflags()
    {
        if (!$this->_permflags && $this->rc->imap)
            $this->_permflags = $this->rc->imap->get_permflags('INBOX');
        return $this->_permflags;
    }

    /**
     * Returns true if the given label is a user label (i.e. not a flag).
     */
    private function is_user_label($label)
    {
        $exclude = $this->rc->config->get('tb_label_exclude');
        // consider exclusion and exit immediately
        if ($this->in_array_caseins($label, $exclude))
            return false;

        // check with server permanent flags
        $server_flags = $this->get_permflags();

        foreach ($server_flags as $flag) {
            $flagtype = substr($flag, 0, 1);
            $nflag = strtoupper(($flagtype == '\\' || $flagtype == '$') ?
                substr($flag, 1) : $flag);

            // system flag
            if ($flagtype == '\\' && !strcasecmp($label, $nflag)) {
                return false;
            }
            // excluded flag
            elseif ($flagtype == '$' && $this->in_array_caseins('$'.$label, $exclude)) {
                return false;
            }
        }

        return true;
    }

    public function color_headers($p)
    {
        #rcube::write_log($this->name, print_r($p, true));
        # -- always write array, even when empty
        $p['content'] .= '<script type="text/javascript">
		var tb_labels_for_message = ['.join(',', array_map(function($x) { return "'".$x."'"; }, $this->message_tb_labels)).'];
		</script>';
        return $p;
    }

    public function read_single_flags($args)
    {
        #rcube::write_log($this->name, print_r(($args['object']), true));
        if (!isset($args['object'])) {
            return;
        }

        if (is_array($args['object']->headers->flags))
        {
            $this->message_tb_labels = array();
            foreach ($args['object']->headers->flags as $flagname => $flagvalue)
            {
                if ($this->is_user_label($flagname)) {
                    if (isset($this->rc->imap->conn->flags[strtoupper($flagname)])) {
                        $flag = $this->rc->imap->conn->flags[strtoupper($flagname)];
                    }
                    else {
                        $flag = ucfirst(strtolower($flagname));
                    }
                    $this->message_tb_labels[] = $flag;
                }
            }
        }

        #rcube::write_log($this->name, print_r($this->message_tb_labels, true));
        # -- no return value for this hook
    }

    public function read_flags($args)
    {
        #rcube::write_log($this->name, print_r($args, true));
        // add color information for all messages
        // dont loop over all messages if we dont have any highlights or no msgs
        if (!isset($args['messages']) or !is_array($args['messages'])) {
                return $args;
        }

        // loop over all messages and add $LabelX info to the extra_flags
        foreach($args['messages'] as $message)
        {
            #rcube::write_log($this->name, print_r($message->flags, true));
            #rcube::write_log($this->name, print_r($this->rc->imap->conn->flags, true));
            $message->list_flags['extra_flags']['tb_labels'] = []; # always set extra_flags, needed for javascript later!
            if (is_array($message->flags))
            foreach ($message->flags as $flagname => $flagvalue)
            {
                if ($this->is_user_label($flagname)) {
                    if (isset($this->rc->imap->conn->flags[strtoupper($flagname)])) {
                        $flag = $this->rc->imap->conn->flags[strtoupper($flagname)];
                    }
                    else {
                        $flag = ucfirst(strtolower($flagname));
                    }
                    $message->list_flags['extra_flags']['tb_labels'][] = $flag;
                }
            }
        }
        return($args);
    }

    // set flags in IMAP server
    function set_flags()
    {
        #rcube::write_log($this->name, print_r($_GET, true));

        $imap = $this->rc->imap;
        $mbox = rcube_utils::get_input_value('_mbox', rcube_utils::INPUT_GET);
        $toggle_label = rcube_utils::get_input_value('_toggle_label', rcube_utils::INPUT_GET);
        $flag_uids = rcube_utils::get_input_value('_flag_uids', rcube_utils::INPUT_GET);
        $flag_uids = explode(',', $flag_uids);
        $unflag_uids = rcube_utils::get_input_value('_unflag_uids', rcube_utils::INPUT_GET);
        $unflag_uids = explode(',', $unflag_uids);

        $imap->conn->flags = array_merge($imap->conn->flags, $this->get_user_labels());

        #rcube::write_log($this->name, print_r($flag_uids, true));
        #rcube::write_log($this->name, print_r($unflag_uids, true));

        if (!is_array($unflag_uids)
            || !is_array($flag_uids))
            return false;

        $imap->set_flag($flag_uids, $toggle_label, $mbox);
        $imap->set_flag($unflag_uids, "UN$toggle_label", $mbox);

        $this->api->output->send();
    }

    function tb_label_popup()
    {
        $custom_labels = $this->get_user_labels();
        #rcube::write_log($this->name, print_r($custom_labels, true));
        $out = '<div id="tb_label_popup" class="popupmenu">
            <ul class="toolbarmenu">';
        foreach ($custom_labels as $key => $value)
        {
            // TODO escape
            $out .= '<li data-label="'.$key.'"><a href="#" class="active"><span class="checkmark-container"><span style="display: none" class="checkmark">&#10004;</span></span> <span class="label-text">'.$value.'</span></a></li>';
        }
        $out .= '</ul>
        </div>';
        $this->rc->output->add_gui_object('tb_label_popup_obj', 'tb_label_popup');
        $this->rc->output->add_footer($out);
    }

    function exclude_virtual_search($args)
    {
        // exclude all folders with the configured prefix
        $exclude = $this->rc->config->get('tb_prefix_exclude_search');
        if (!empty($exclude) && is_array($args['folder'])) {
            $folder = [];
            foreach ($args['folder'] as $f) {
                if (strpos($f, $exclude) !== 0) {
                    $folder[] = $f;
                }
            }
        }
        else {
            // if folder is not an array, we are forcing our search into the virtual folders, but that's ok
            $folder = $args['folder'];
        }

        return [
            'folder'     => $folder,
            'search'     => $args['search'],
            'charset'    => $args['charset'],
            'sort_field' => $args['sort_field'],
            'result'     => null,
        ];
    }

}

