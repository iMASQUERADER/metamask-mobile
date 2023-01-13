interface BodyWebView {
  source: 'WebView';
  uri: string;
}

interface BodyNode {
  source: 'Node';
  component: () => React.ReactNode;
}

type Body = BodyWebView | BodyNode;

interface MandatoryModalParams {
  params: {
    /**
     * Optional Body, can be a customized componente or a uri for a webview
     */
    body: Body;
    /**
     * Header title of the modal
     */
    headerTitle: string;
    /**
     * On press mandatory modal function
     * @returns void
     */
    onAccept: () => void;
    /**
     * Optional text for the footer fo the modal
     */
    footerHelpText?: string;
    /**
     * Text of the button of the modal
     */
    buttonText: string;
    /**
     * Text of the check button of the modal
     */
    checkboxText: string;
    /**
     * Optional function that it will happen when the Modal renders.
     * @returns void
     */
    onRender?: () => void;
  };
}

export interface MandatoryModalProps {
  route: MandatoryModalParams;
}
