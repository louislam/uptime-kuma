import { actor } from "../support/actors/actor";
import { DEFAULT_USER_DATA } from "../support/const/user-data";
import { DashboardPage } from "../support/pages/dasboard-page";
import { SetupPage } from "../support/pages/setup-page";

describe("user can create a new account on setup page", () => {
    before(() => {
        cy.visit("/setup");
    });

    it("user can create new account", () => {
        cy.url().should("be.equal", SetupPage.url);
        actor.setupTask.fillAndSubmitSetupForm(
            DEFAULT_USER_DATA.username,
            DEFAULT_USER_DATA.password,
            DEFAULT_USER_DATA.password
        );

        cy.url().should("be.equal", DashboardPage.url);
        cy.get('[role="alert"]')
            .should("be.visible")
            .and("contain.text", "Added Successfully.");
    });
});
