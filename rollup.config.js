export default {
  input: 'editor.js',
  output: {
    file: 'build/odoo-editor-bundle.js',
    format: 'iife',
    name: 'exportVariable',
    banner: "odoo.define('web_editor.odoo-editor', (function(require) {",
    footer: 'return exportVariable;\n}));',
  }
};
