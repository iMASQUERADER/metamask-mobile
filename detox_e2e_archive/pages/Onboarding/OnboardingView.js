import TestHelpers from '../../helpers';

const ONBOARDING_SCREEN_ID = 'onboarding-screen';
const CREATE_WALLET_BUTTON_ID = 'create-wallet-button';
const IMPORT_FROM_SEED_BUTTON_ID = 'import-from-seed-import-from-seed-button';
//const importUsingSecretRecoveryPhrase = 'import-from-seed-import-from-seed-button';
export default class OnboardingView {
  static async tapCreateWallet() {
    await TestHelpers.tap(CREATE_WALLET_BUTTON_ID);
  }

  static async tapImportWalletFromSeedPhrase() {
    await TestHelpers.tap(IMPORT_FROM_SEED_BUTTON_ID);
  }

  static async isVisible() {
    await TestHelpers.checkIfVisible(ONBOARDING_SCREEN_ID);
  }

  static async isNotVisible() {
    await TestHelpers.checkIfNotVisible(ONBOARDING_SCREEN_ID);
  }
}