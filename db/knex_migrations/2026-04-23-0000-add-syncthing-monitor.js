exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("syncthing_url").defaultTo(null);
        table.string("syncthing_api_key", 255).defaultTo(null);
        table.string("syncthing_check_type", 20).defaultTo(null);
        table.text("syncthing_filter").defaultTo(null);
        table.string("syncthing_filter_mode", 10).defaultTo(null);
        table.double("syncthing_peer_timeout").defaultTo(null);
        table.double("syncthing_folder_sync_threshold").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("syncthing_url");
        table.dropColumn("syncthing_api_key");
        table.dropColumn("syncthing_check_type");
        table.dropColumn("syncthing_filter");
        table.dropColumn("syncthing_filter_mode");
        table.dropColumn("syncthing_peer_timeout");
        table.dropColumn("syncthing_folder_sync_threshold");
    });
};
