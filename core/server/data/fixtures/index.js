var when        = require('when'),
    sequence    = require('when/sequence'),
    _           = require('lodash'),
    utils       = require('../../utils'),
    models      = require('../../models'),
    fixtures    = require('./fixtures'),

    populateFixtures,
    updateFixtures;

populateFixtures = function () {
    var ops = [],
        relations = [],

        Post = models.Post,
        Tag = models.Tag,
        Role = models.Role,
        Permission = models.Permission,
        Permissions = models.Permissions,
        Client = models.Client,
        User = models.User;

    _.each(fixtures.posts, function (post) {
        ops.push(function () {return Post.add(post, {user: 1}); });
    });

    _.each(fixtures.tags, function (tag) {
        ops.push(function () {return Tag.add(tag, {user: 1}); });
    });

    _.each(fixtures.roles, function (role) {
        ops.push(function () {return Role.add(role, {user: 1}); });
    });

    _.each(fixtures.roles003, function (role) {
        ops.push(function () {return Role.add(role, {user: 1}); });
    });

    _.each(fixtures.permissions, function (permission) {
        ops.push(function () {return Permission.add(permission, {user: 1}); });
    });

    _.each(fixtures.permissions003, function (permission) {
        ops.push(function () {return Permission.add(permission, {user: 1}); });
    });

    _.each(fixtures.client003, function (client) {
        ops.push(function () {return Client.add(client, {user: 1}); });
    });

    // add the tag to the post
    relations.push(function () {
        return Post.forge({id: 1}).fetch({withRelated: ['tags']}).then(function (post) {
            return post.tags().attach([1]);
        });
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
    }).then(function () {
        return Role.findOne({name: 'Owner'});
    }).then(function (ownerRole) {
        var user = fixtures.users003[0];
        user.role = ownerRole.id;
        user.password = utils.uid(50);

        return User.add(user, {user: 1});
    });
};

updateFixtures = function () {
    var ops = [],
        relations = [],
        adminUser,
        Role = models.Role,
        Permission = models.Permission,
        Permissions = models.Permissions,
        Client = models.Client,
        User = models.User;

    _.each(fixtures.permissions003, function (permission) {
        ops.push(function () {return Permission.add(permission, {user: 1}); });
    });

    _.each(fixtures.client003, function (client) {
        ops.push(function () {return Client.add(client, {user: 1}); });
    });

    _.each(fixtures.roles003, function (role) {
        ops.push(function () {return Role.add(role, {user: 1}); });
    });

    relations.push(function () {
        var relationOps = [],
            relationOp;

        // admin gets all new permissions
        relationOp = Role.forge({name: 'Administrator'}).fetch({withRelated: ['permissions']}).then(function (role) {
            return Permissions.forge().fetch().then(function (perms) {
                var admin_perm = _.map(perms.toJSON(), function (perm) {
                    var result  = fixtures.permissions003.filter(function (object) {
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
    }).then(function () {
        return User.forge({id: 1}).fetch();
    }).then(function (user) {
        adminUser = user;
        return Role.findOne({name: 'Owner'});
    }).then(function (ownerRole) {
        if (adminUser) {
            return adminUser.roles().updatePivot({role_id: ownerRole.id});
        }
    });
};

module.exports = {
    populateFixtures: populateFixtures,
    updateFixtures: updateFixtures
};
