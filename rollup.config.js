import css from 'rollup-plugin-css-only';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

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
        plugins: [nodeResolve(), commonjs()],
    },
    {
        input: 'src/public/style.css',
        output: {
            file: 'build/odoo-editor-bundle.css',
        },
        plugins: [css({ output: 'odoo-editor-bundle.css' })],
    },
    {
        input: 'src/main.js',
        output: {
            file: 'build/main.js',
            format: 'iife',
            name: 'tests',
            sourcemap: true,
        },
        plugins: [nodeResolve(), commonjs()],
    },
];
