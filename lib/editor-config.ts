export interface EditorToolConfig {
  fontFamily: boolean;
  fontSize: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  textColor: boolean;
  highlight: boolean;
  align: boolean;
  lists: boolean;
  subscript: boolean;
  superscript: boolean;
  horizontalRule: boolean;
  clearFormat: boolean;
  history: boolean;
  headings: boolean;
  snippets: boolean;
  stats: boolean;
}

export function getEditorConfig(): EditorToolConfig {
  const getEnvBool = (key: string, defaultValue: boolean): boolean => {
    if (typeof process === 'undefined' || !process.env) return defaultValue;
    const val = process.env[key];
    if (val === undefined || val === '') return defaultValue;
    return val === 'true' || val === '1';
  };

  return {
    fontFamily: getEnvBool('NEXT_PUBLIC_EDITOR_FONT_FAMILY', true),
    fontSize: getEnvBool('NEXT_PUBLIC_EDITOR_FONT_SIZE', true),
    bold: getEnvBool('NEXT_PUBLIC_EDITOR_BOLD', true),
    italic: getEnvBool('NEXT_PUBLIC_EDITOR_ITALIC', true),
    underline: getEnvBool('NEXT_PUBLIC_EDITOR_UNDERLINE', true),
    strike: getEnvBool('NEXT_PUBLIC_EDITOR_STRIKE', true),
    textColor: getEnvBool('NEXT_PUBLIC_EDITOR_TEXT_COLOR', true),
    highlight: getEnvBool('NEXT_PUBLIC_EDITOR_HIGHLIGHT', true),
    align: getEnvBool('NEXT_PUBLIC_EDITOR_ALIGN', true),
    lists: getEnvBool('NEXT_PUBLIC_EDITOR_LISTS', true),
    subscript: getEnvBool('NEXT_PUBLIC_EDITOR_SUBSCRIPT', true),
    superscript: getEnvBool('NEXT_PUBLIC_EDITOR_SUPERSCRIPT', true),
    horizontalRule: getEnvBool('NEXT_PUBLIC_EDITOR_HR', true),
    clearFormat: getEnvBool('NEXT_PUBLIC_EDITOR_CLEAR_FORMAT', true),
    history: getEnvBool('NEXT_PUBLIC_EDITOR_HISTORY', true),
    headings: getEnvBool('NEXT_PUBLIC_EDITOR_HEADINGS', false), // Off by default as user requested Word-style font size instead
    snippets: getEnvBool('NEXT_PUBLIC_EDITOR_SNIPPETS', true),
    stats: getEnvBool('NEXT_PUBLIC_EDITOR_STATS', true),
  };
}
