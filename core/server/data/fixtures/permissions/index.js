var when        = require('when'),
    sequence    = require('when/sequence'),
    _           = require('lodash'),

    models      = require('../../../models'),
    fixtures    = require('./permissions'),

    populate,
    to003;

populate = function () {
    var ops = [],
        relations = [],
        Role = models.Role,
        Permission = models.Permission,
        Permissions = models.Permissions;

    _.each(fixtures.permissions, function (permission) {
        ops.push(function () { return Permission.add(permission); });
    });

    //grant permissions to roles
    relations.push(function () {
        var relationOps = [],
            relationOp;

        // admins gets all permissions
        relationOp = Role.forge({name: 'Administrator'}).fetch({withRelated: ['permissions']}).then(function (role) {
            return Permissions.forge().fetch().then(function (perms) {
                var admin_perm = _.map(perms.toJSON(), function (perm) {
                    return perm.id;
                });
                return role.permissions().attach(_.compact(admin_perm));
            });
        });
        relationOps.push(relationOp);

        // editor gets access to posts, users and settings.browse, settings.read
        relationOp = Role.forge({name: 'Editor'}).fetch({withRelated: ['permissions']}).then(function (role) {
            return Permissions.forge().fetch().then(function (perms) {
                var editor_perm = _.map(perms.toJSON(), function (perm) {
                    if (perm.object_type === 'post' || perm.object_type === 'user' || perm.object_type === 'slug') {
                        return perm.id;
                    }
                    if (perm.object_type === 'setting' &&
                            (perm.action_type === 'browse' || perm.action_type === 'read')) {
                        return perm.id;
                    }
                    return null;
                });
                return role.permissions().attach(_.compact(editor_perm));
            });
        });
        relationOps.push(relationOp);

        // author gets access to post.add, slug.generate, settings.browse, settings.read, users.browse and users.read
        relationOp = Role.forge({name: 'Author'}).fetch({withRelated: ['permissions']}).then(function (role) {
            return Permissions.forge().fetch().then(function (perms) {
                var author_perm = _.map(perms.toJSON(), function (perm) {
                    if (perm.object_type === 'post' && perm.action_type === 'add') {
                        return perm.id;
                    }
                    if (perm.object_type === 'slug' && perm.action_type === 'generate') {
                        return perm.id;
                    }
                    if (perm.object_type === 'setting' &&
                            (perm.action_type === 'browse' || perm.action_type === 'read')) {
                        return perm.id;
                    }
                    if (perm.object_type === 'user' &&
                            (perm.action_type === 'browse' || perm.action_type === 'read')) {
                        return perm.id;
                    }
                    return null;
                });
                return role.permissions().attach(_.compact(author_perm));
            });
        });
        relationOps.push(relationOp);

        return when.all(relationOps);
    });

    return sequence(ops).then(function () {
        return sequence(relations);
    });
};

// ### Update permissions to 003
// Need to rename old permissions, and then add all of the missing oness
to003 = function () {
    var ops = [],
        relations = [],
        Role = models.Role,
        Permission = models.Permission,
        Permissions = models.Permissions,
        // Permissions that didn't exist before 003
        newPermissions = fixtures.permissions.slice(3);

    _.each(newPermissions, function (permission) {
        ops.push(function () { return Permission.add(permission); });
    });

    relations.push(function () {
        var relationOps = [],
            relationOp;

        // admin gets all new permissions
        relationOp = Role.forge({name: 'Administrator'}).fetch({withRelated: ['permissions']}).then(function (role) {
            return Permissions.forge().fetch().then(function (perms) {
                var admin_perm = _.map(perms.toJSON(), function (perm) {
                    var result  = fixtures.permissions.filter(function (object) {
                        return object.object_type === perm.object_type && object.action_type === perm.action_type;
                    });
                    if (!_.isEmpty(result)) {
                        return perm.id;
                    }
                    return null;
                });
                return role.permissions().attach(_.compact(admin_perm));
            });
        });
        relationOps.push(relationOp);

        // editor gets access to posts, users and settings.browse, settings.read
        relationOp = Role.forge({name: 'Editor'}).fetch({withRelated: ['permissions']}).then(function (role) {
            return Permissions.forge().fetch().then(function (perms) {
                var editor_perm = _.map(perms.toJSON(), function (perm) {
                    if (perm.object_type === 'post' || perm.object_type === 'user') {
                        return perm.id;
                    }
                    if (perm.object_type === 'setting' &&
                            (perm.action_type === 'browse' || perm.action_type === 'read')) {
                        return perm.id;
                    }
                    return null;
                });
                return role.permissions().attach(_.compact(editor_perm));
            });
        });
        relationOps.push(relationOp);

        // author gets access to post.add, post.slug, settings.browse, settings.read, users.browse and users.read
        relationOp = Role.forge({name: 'Author'}).fetch({withRelated: ['permissions']}).then(function (role) {
            return Permissions.forge().fetch().then(function (perms) {
                var author_perm = _.map(perms.toJSON(), function (perm) {
                    if (perm.object_type === 'post' && perm.action_type === 'add') {
                        return perm.id;
                    }
                    if (perm.object_type === 'slug' && perm.action_type === 'generate') {
                        return perm.id;
                    }
                    if (perm.object_type === 'setting' &&
                            (perm.action_type === 'browse' || perm.action_type === 'read')) {
                        return perm.id;
                    }
                    if (perm.object_type === 'user' &&
                            (perm.action_type === 'browse' || perm.action_type === 'read')) {
                        return perm.id;
                    }
                    return null;
                });
                return role.permissions().attach(_.compact(author_perm));
            });
        });
        relationOps.push(relationOp);

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
