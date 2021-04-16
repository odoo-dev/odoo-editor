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
        plugins: [nodeResolve({ browser: true }), commonjs()],
    },
    {
        input: 'src/style.css',
        output: {
            file: 'build/odoo-editor-bundle.css',
        },
        plugins: [css({ output: 'odoo-editor-bundle.css' })],
    },
    {
        input: 'src/style.css',
        output: {
            file: 'dev/style.css',
        },
        plugins: [css({ output: 'style.css' })],
    },
    {
        input: 'src/tests/index.js',
        output: {
            file: 'dev/test-suites.js',
            format: 'umd',
            name: 'tests',
            sourcemap: true,
        },
        plugins: [nodeResolve({ browser: true }), commonjs()],
    },
    {
        input: 'src/main.js',
        output: {
            file: 'dev/main.js',
            format: 'umd',
            name: 'tests',
            sourcemap: true,
        },
        plugins: [nodeResolve({ browser: true }), commonjs()],
    },
];
