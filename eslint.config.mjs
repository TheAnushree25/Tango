import next from 'eslint-config-next';

const config = [{ ignores: ['.next/**', 'node_modules/**', 'public/**', 'tools/**'] }, ...next];

export default config;
