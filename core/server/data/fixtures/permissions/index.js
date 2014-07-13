// # Permissions Fixtures
// Sets up the permissions, and the default permissions_roles relationships
var when        = require('when'),
    sequence    = require('when/sequence'),
    _           = require('lodash'),

    models      = require('../../../models'),
    fixtures    = require('./permissions'),

    populate,
    to003,
    createPermissionsForRole;

createPermissionsForRole = function (roleName) {
    var fixturesForRole = fixtures.permissions_roles[roleName],
        permissionsToAdd;

    return models.Role.forge({name: roleName}).fetch({withRelated: ['permissions']}).then(function (role) {
        return models.Permissions.forge().fetch({withRelated: ['roles']}).then(function (permissions) {
            if (_.isObject(fixturesForRole)) {
                permissionsToAdd = _.map(permissions.toJSON(), function (permission) {
                    var objectPermissions = fixturesForRole[permission.object_type];
                    if (objectPermissions === 'all') {
                        return permission.id;
                    } else if (_.isArray(objectPermissions) && _.contains(objectPermissions, permission.action_type)) {
                        return permission.id;
                    }
                    return null;
                });
            }

            return role.permissions().attach(_.compact(permissionsToAdd));
        });
    });
};

// ## Populate
populate = function () {
    var ops = [],
        relations = [],
        Permission = models.Permission;

    // ### Ensure all permissions are inserted
    _.each(fixtures.permissions, function (permissions, object_type) {
        _.each(permissions, function (permission) {
            ops.push(function () {
                permission.object_type = object_type;
                return Permission.add(permission);
            });
        });
    });

    // ### Grant permissions to roles
    relations.push(function () {
        var relationOps = [];

        // #### Owner
        // Owner gets all permissions by default, this is an override in canThis, rather than being managed
        // by the database.

        // #### Administrator
        // Admin gets all new permissions
        relationOps.push(createPermissionsForRole('Administrator'));

        // #### Editor
        // editor gets access to posts, users and settings.browse, settings.read
        relationOps.push(createPermissionsForRole("Editor"));

        // #### Author
        // author gets access to post.add, slug.generate, settings.browse, settings.read, users.browse and users.read
        relationOps.push(createPermissionsForRole("Author"));

        return when.all(relationOps);
    });

    return sequence(ops).then(function () {
        return sequence(relations);
    });
};

// ## Update
// Update permissions to 003
// Need to rename old permissions, and then add all of the missing oness
to003 = function () {
    var ops = [],
        relations = [],
        Permission = models.Permission;

    // ### Ensure all permissions are inserted
    _.each(fixtures.permissions, function (permissions, object_type) {
        // Post permissions were already present, don't re-add these
        if (object_type !== 'post') {
            _.each(permissions, function (permission) {
                ops.push(function () {
                    permission.object_type = object_type;
                    return Permission.add(permission);
                });
            });
        }
    });

    // ### Grant permissions to roles
    relations.push(function () {
        var relationOps = [];

        // #### Owner
        // Owner gets all permissions by default, this is an override in canThis, rather than being managed
        // by the database.

        // #### Administrator
        // Admin gets all new permissions
        relationOps.push(createPermissionsForRole('Administrator'));

        // #### Editor
        // editor gets access to posts, users and settings.browse, settings.read
        relationOps.push(createPermissionsForRole("Editor"));

        // #### Author
        // author gets access to post.add, slug.generate, settings.browse, settings.read, users.browse and users.read
        relationOps.push(createPermissionsForRole("Author"));

        return when.all(relationOps);
    });

    return sequence(ops).then(function () {
        return sequence(relations);
    });
};

module.exports = {
    populate: populate,
    to003: to003
};
