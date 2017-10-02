## Labels plugin for Roundcube Webmail

Forked from https://github.com/mike-kfed/rcmail-thunderbird-labels

### Install
1. unpack to plugins directory
2. add `, 'labels'` to `$rcmail_config['plugins']` in config.inc.php
3. if you run a custom skin, e.g. `silver` then you should also symlink or copy the skins folder
   of the plugin to the corresponding skins name, for the example given:
   `ln -s plugins/labels/skins/larry plugins/labels/skins/silver`

### Configure

See config.inc.php

- `tb_label_enable = true/false` (can be changed by user in prefs UI)
- `tb_label_modify_labels = true/false`
- `tb_label_enable_contextmenu = true/false`
- `tb_label_enable_shortcuts = true/false` (can be changed by user in prefs UI)
- `tb_label_style = 'bullets'` or `'thunderbird'`

### Original author
Michael Kefeder
https://github.com/mike-kfed/rcmail-thunderbird-labels
