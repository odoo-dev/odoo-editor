import css from 'rollup-plugin-css-only';

export default [
    {
        input: 'src/editor.js',
        output: {
            file: 'build/odoo-editor-bundle.js',
            format: 'iife',
            name: 'exportVariable',
            banner: "odoo.define('web_editor.odoo-editor', (function(require) {",
            footer: 'return exportVariable;\n}));',
        },
    },
    {
        input: 'src/style.css',
        output: {
            file: 'build/odoo-editor-bundle.css',
        },
        plugins: [css({ output: 'odoo-editor-bundle.css' })],
    },
];
