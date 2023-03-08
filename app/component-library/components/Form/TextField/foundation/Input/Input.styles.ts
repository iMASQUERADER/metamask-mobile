// Third party dependencies.
import { StyleSheet, TextStyle } from 'react-native';

// External dependencies.
import { Theme } from '../../../../../../util/theme/models';
import { colors } from '../../../../../../styles/common';

/**
 * Style sheet function for Input component.
 *
 * @param params Style sheet params.
 * @param params.theme App theme from ThemeContext.
 * @param params.vars Inputs that the style sheet depends on.
 * @returns StyleSheet object.
 */
const styleSheet = (params: { theme: Theme; vars: any }) => {
  const { theme, vars } = params;
  const { style, textVariant, disabled, disableStateStyles, isFocused } = vars;
  const stateObj = disableStateStyles
    ? {
        opacity: 1,
      }
    : {
        opacity: disabled ? 0.5 : 1,
        borderColor: isFocused
          ? theme.colors.primary.default
          : colors.transparent,
      };
  return StyleSheet.create({
    base: Object.assign(
      {
        color: theme.colors.text.default,
        borderWidth: 1,
        borderColor: colors.transparent,
        backgroundColor: theme.colors.background.default,
        height: 24,
        ...stateObj,
        fontFamily: theme.typography[textVariant].fontFamily,
        fontWeight: theme.typography[textVariant].fontWeight,
        fontSize: theme.typography[textVariant].fontSize,
        letterSpacing: theme.typography[textVariant].letterSpacing,
      },
      style,
    ) as TextStyle,
  });
};

export default styleSheet;
