var _               = require('lodash'),
    when            = require('when'),
    path            = require('path'),
    fs              = require('fs'),
    nodefn          = require('when/node'),
    errors          = require('../../errors'),
    sequence        = require('when/sequence'),

    versioning      = require('../versioning'),
    models          = require('../../models'),
    fixtures        = require('../fixtures'),
    schema          = require('../schema').tables,
    dataExport      = require('../export'),
    utils           = require('../utils'),
    config          = require('../../config'),

    schemaTables    = _.keys(schema),

    init,
    reset,
    migrateUp,
    migrateUpFreshDb;

function logInfo(message) {
    errors.logInfo('Migrations', message);
}

function getDeleteCommands(oldTables, newTables) {
    var deleteTables = _.difference(oldTables, newTables);
    if (!_.isEmpty(deleteTables)) {
        return _.map(deleteTables, function (table) {
            return function () {
                logInfo('Deleting table: ' + table);
                return utils.deleteTable(table);
            };
        });
    }
}

function getAddCommands(oldTables, newTables) {
    var addTables = _.difference(newTables, oldTables);
    if (!_.isEmpty(addTables)) {
        return _.map(addTables, function (table) {
            return function () {
                logInfo('Creating table: ' + table);
                return utils.createTable(table);
            };
        });
    }
}

function addColumnCommands(table, columns) {
    var columnKeys = _.keys(schema[table]),
        addColumns = _.difference(columnKeys, columns);

    return _.map(addColumns, function (column) {
        return function () {
            logInfo('Adding column: ' + table + '.' + column);
            utils.addColumn(table, column);
        };
    });
}

function modifyUniqueCommands(table, indexes) {
    var columnKeys = _.keys(schema[table]);
    return _.map(columnKeys, function (column) {
        if (schema[table][column].unique && schema[table][column].unique === true) {
            if (!_.contains(indexes, table + '_' + column + '_unique')) {
                return function () {
                    logInfo('Adding unique on: ' + table + '.' + column);
                    return utils.addUnique(table, column);
                };
            }
        } else if (!schema[table][column].unique) {
            if (_.contains(indexes, table + '_' + column + '_unique')) {
                return function () {
                    logInfo('Dropping unique on: ' + table + '.' + column);
                    return utils.dropUnique(table, column);
                };
            }
        }
    });
}

// Check for whether data is needed to be bootstrapped or not
init = function () {
    var self = this;
    // There are 4 possibilities:
    // 1. The database exists and is up-to-date
    // 2. The database exists but is out of date
    // 3. The database exists but the currentVersion setting does not or cannot be understood
    // 4. The database has not yet been created
    return versioning.getDatabaseVersion().then(function (databaseVersion) {
        var defaultVersion = versioning.getDefaultDatabaseVersion();
        if (databaseVersion === defaultVersion) {
            // 1. The database exists and is up-to-date
            logInfo('Up to date at version ' + databaseVersion);
            return when.resolve();
        }
        if (databaseVersion < defaultVersion) {
            // 2. The database exists but is out of date
            // Migrate to latest version
            logInfo('Database upgrade required from version ' + databaseVersion + ' to ' +  defaultVersion);
            return self.migrateUp(databaseVersion, defaultVersion).then(function () {
                // Finally update the databases current version
                return versioning.setDatabaseVersion();
            });
        }
        if (databaseVersion > defaultVersion) {
            // 3. The database exists but the currentVersion setting does not or cannot be understood
            // In this case we don't understand the version because it is too high
            errors.logErrorAndExit(
                'Your database is not compatible with this version of Ghost',
                'You will need to create a new database'
            );
        }
    }, function (err) {
        if (err.message || err === 'Settings table does not exist') {
            // 4. The database has not yet been created
            // Bring everything up from initial version.
            logInfo('Database initialisation required for version ' + versioning.getDefaultDatabaseVersion());
            return self.migrateUpFreshDb();
        }
        // 3. The database exists but the currentVersion setting does not or cannot be understood
        // In this case the setting was missing or there was some other problem
        errors.logErrorAndExit('There is a problem with the database', err.message || err);
    });
};

// ### Reset
// Delete all tables from the database in reverse order
reset = function () {
    var tables = [];
    tables = _.map(schemaTables, function (table) {
        return function () {
            return utils.deleteTable(table);
        };
    }).reverse();

    return sequence(tables);
};

// Only do this if we have no database at all
migrateUpFreshDb = function () {
    var tables = [];
    tables = _.map(schemaTables, function (table) {
        return function () {
            logInfo('Creating table: ' + table);
            return utils.createTable(table);
        };
    });
    logInfo('Creating tables...');
    return sequence(tables).then(function () {
        // Load the fixtures
        logInfo('Populating fixtures');
        return fixtures.populate();
    }).then(function () {
        // Initialise the default settings
        logInfo('Populating default settings');
        return models.Settings.populateDefaults().then(function () {
            logInfo('Complete');
        });
    });
};

// This function changes the type of posts.html and posts.markdown columns to mediumtext. Due to
// a wrong datatype in schema.js some installations using mysql could have been created using the
// data type text instead of mediumtext.
// For details see: https://github.com/TryGhost/Ghost/issues/1947
function checkMySQLPostTable() {
    var knex = config().database.knex;

    return knex.raw("SHOW FIELDS FROM posts where Field ='html' OR Field = 'markdown'").then(function (response) {
        return _.flatten(_.map(response[0], function (entry) {
            if (entry.Type.toLowerCase() !== 'mediumtext') {
                return knex.raw("ALTER TABLE posts MODIFY " + entry.Field + " MEDIUMTEXT").then(function () {
                    return when.resolve();
                });
            }
        }));
    });
}

function backupDatabase() {
    return dataExport().then(function (exportedData) {
        // Save the exported data to the file system for download
        var fileName = path.resolve(config().paths.contentPath + '/data/exported-' + (new Date().getTime()) + '.json');

        return nodefn.call(fs.writeFile, fileName, JSON.stringify(exportedData)).then(function () {
            logInfo('Database backup written to: ' + fileName);
        });
    });
}

// Migrate from a specific version to the latest
migrateUp = function (fromVersion, toVersion) {
    var deleteCommands,
        addCommands,
        oldTables,
        client = config().database.client,
        addColumns = [],
        modifyUniCommands = [],
        commands = [];

    logInfo('Creating database backup');
    return backupDatabase().then(function () {
        return utils.getTables().then(function (tables) {
            oldTables = tables;
        });
    }).then(function () {
        // if tables exist and client is mysqls check if posts table is okay
        if (!_.isEmpty(oldTables) && client === 'mysql') {
            return checkMySQLPostTable();
        }
    }).then(function () {
        deleteCommands = getDeleteCommands(oldTables, schemaTables);
        addCommands = getAddCommands(oldTables, schemaTables);
        return when.all(
            _.map(oldTables, function (table) {
                return utils.getIndexes(table).then(function (indexes) {
                    modifyUniCommands = modifyUniCommands.concat(modifyUniqueCommands(table, indexes));
                });
            })
        );
    }).then(function () {
        return when.all(
            _.map(oldTables, function (table) {
                return utils.getColumns(table).then(function (columns) {
                    addColumns = addColumns.concat(addColumnCommands(table, columns));
                });
            })
        );

    }).then(function () {
        modifyUniCommands = _.compact(modifyUniCommands);

        // delete tables
        if (!_.isEmpty(deleteCommands)) {
            commands = commands.concat(deleteCommands);
        }
        // add tables
        if (!_.isEmpty(addCommands)) {
            commands = commands.concat(addCommands);
        }
        // add columns if needed
        if (!_.isEmpty(addColumns)) {
            commands = commands.concat(addColumns);
        }
        // add/drop unique constraint
        if (!_.isEmpty(modifyUniCommands)) {
            commands = commands.concat(modifyUniCommands);
        }
        // execute the commands in sequence
        if (!_.isEmpty(commands)) {
            logInfo('Running migrations');
            return sequence(commands);
        }
        return;
    }).then(function () {
        logInfo('Updating fixtures');

        return fixtures.update(fromVersion, toVersion);
    }).then(function () {
        // Initialise the default settings
        logInfo('Populating default settings');
        return models.Settings.populateDefaults().then(function () {
            logInfo('Complete');
        });
    });
};

module.exports = {
    init: init,
    reset: reset,
    migrateUp: migrateUp,
    migrateUpFreshDb: migrateUpFreshDb
};
