import { SetupPage } from "../pages/setup-page";

export class SetupTask {
    fillAndSubmitSetupForm(
        username: string,
        password: string,
        passwordRepeat: string
    ) {
        cy.get(SetupPage.usernameInput).type(username);
        cy.get(SetupPage.passWordInput).type(password);
        cy.get(SetupPage.passwordRepeatInput).type(passwordRepeat);

        cy.get(SetupPage.submitSetupForm).click();
    }
}
