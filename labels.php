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
    private $map;

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
            #$this->add_hook('messages_list', array($this, 'read_flags'));
            #$this->add_hook('message_load', array($this, 'read_single_flags'));
            #$this->add_hook('template_object_messageheaders', array($this, 'color_headers'));
            $this->add_hook('render_page', array($this, 'tb_label_popup'));
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
        // TODO pass label strings to JS
        //$this->rc->output->set_env('tb_label_custom_labels', $this->rc->config->get('tb_label_custom_labels'));
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
        $server_flags = $this->rc->imap->get_permflags('INBOX');
        $custom_labels = $this->rc->config->get('tb_label_custom_labels');
        $labels = [];

        foreach ($server_flags as $flag) {
            if (!(in_array('\\*', $exclude) && substr($flag, 0, 1) == '\\') &&
                !$this->in_array_caseins($flag, $exclude)) {
                $labels[] = $flag;
            }
        }

        foreach ($custom_labels as $label) {
            if (!empty($label) && !$this->in_array_caseins($label, $labels)) {
                $labels[] = $label;
            }
        }

        return $labels;
    }

    function tb_label_popup()
    {
        $custom_labels = $this->get_user_labels();
        rcube::write_log($this->name, print_r($custom_labels, true));
        $out = '<div id="tb_label_popup" class="popupmenu">
            <ul class="toolbarmenu">';
        for ($i = 0; $i < 10; $i++)
        {
            // TODO escape
            $out .= '<li data-label="'.$custom_labels[$i].'"><a href="#" class="active"><span class="checkmark-container"><span style="display: none" class="checkmark">&#10004;</span></span> '.$custom_labels[$i].'</a></li>';
        }
        $out .= '</ul>
        </div>';
        $this->rc->output->add_gui_object('tb_label_popup_obj', 'tb_label_popup');
        $this->rc->output->add_footer($out);
    }

}

