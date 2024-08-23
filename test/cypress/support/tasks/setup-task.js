const setupPage = require("../pages/setup-page");

class SetupTask {
    fillAndSubmitSetupForm(username, password, passwordRepeat) {
        cy.get(setupPage.SetupPage.usernameInput).type(username);
        cy.get(setupPage.SetupPage.passWordInput).type(password);
        cy.get(setupPage.SetupPage.passwordRepeatInput).type(passwordRepeat);
        cy.get(setupPage.SetupPage.submitSetupForm).click();
    }
}
exports.SetupTask = SetupTask;
