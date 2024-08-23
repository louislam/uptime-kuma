const actor = require("../support/actors/actor");
const userData = require("../support/const/user-data");
const dashboardPage = require("../support/pages/dashboard-page");
const setupPage = require("../support/pages/setup-page");

describe("user can create a new account on setup page", () => {
    before(() => {
        cy.visit("/setup");
    });
    it("user can create new account", () => {
        cy.url().should("be.equal", setupPage.SetupPage.url);
        actor.actor.setupTask.fillAndSubmitSetupForm(userData.DEFAULT_USER_DATA.username, userData.DEFAULT_USER_DATA.password, userData.DEFAULT_USER_DATA.password);
        cy.url().should("be.equal", dashboardPage.DashboardPage.url);
        cy.get('[role="alert"]')
            .should("be.visible")
            .and("contain.text", "Added Successfully.");
    });
});
