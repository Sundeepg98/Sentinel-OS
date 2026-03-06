export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'infra', 'chore', 'docs', 'test', 'style', 'ci']
    ],
    'subject-case': [0] // Allow sentence case for technical subject lines
  }
};
