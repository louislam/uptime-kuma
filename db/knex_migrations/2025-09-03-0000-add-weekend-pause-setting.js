// Add weekend pause setting to settings table
exports.up = async function (knex) {
    // Insert the weekend pause setting with default value false (disabled)
    await knex("setting").insert({
        key: "weekendPauseEnabled",
        value: "0", // Default to disabled
        type: "boolean"
    });
};

exports.down = function (knex) {
    return knex("setting").where({ key: "weekendPauseEnabled" }).del();
}; 