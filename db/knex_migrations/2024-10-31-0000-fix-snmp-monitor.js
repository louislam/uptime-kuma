exports.up = function (knex) {
    return knex('monitor').whereNull('json_path_operator').update('json_path_operator', '==');
};
exports.down = function (knex) {};
