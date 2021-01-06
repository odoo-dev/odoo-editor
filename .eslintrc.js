module.exports = {
    'parserOptions': {
        'sourceType': 'module',
        'ecmaVersion': '2020',
    },
    'extends': [
        'eslint:recommended',
        'prettier',
        'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    ],
    'rules': {
        'dot-notation': 'error',
    },
    'ignorePatterns': ['node_modules/', 'build/'],
    'env': {
        'es6': true,
        'browser': true,
        'mocha': true,
    },
};
