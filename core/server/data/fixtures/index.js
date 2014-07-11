var sequence    = require('when/sequence'),
    _           = require('lodash'),
    utils       = require('../../utils'),
    models      = require('../../models'),
    fixtures    = require('./fixtures'),
    permissions = require('./permissions'),

    populate,
    update,
    to003,
    fetchAdmin;


fetchAdmin = function () {
    return models.User.forge().fetch({
        withRelated: [{
            'roles': function (qb) {
                qb.where('name', 'Administrator');
            }
        }]
    });
};

populate = function () {
    var ops = [],
        relations = [],
        Post = models.Post,
        Tag = models.Tag,
        Role = models.Role,
        Client = models.Client,
        User = models.User;

    _.each(fixtures.posts, function (post) {
        ops.push(function () { return Post.add(post); });
    });

    _.each(fixtures.tags, function (tag) {
        ops.push(function () { return Tag.add(tag); });
    });

    _.each(fixtures.roles, function (role) {
        ops.push(function () { return Role.add(role); });
    });

    _.each(fixtures.client, function (client) {
        ops.push(function () { return Client.add(client); });
    });

    // add the tag to the post
    relations.push(function () {
        return Post.forge({slug: fixtures.posts[0].slug}).fetch({withRelated: ['tags']}).then(function (post) {
            return Tag.forge({slug: fixtures.tags[0].slug}).fetch().then(function (tag) {
                return post.tags().attach(tag);
            });
        });
    });

    return sequence(ops).then(function () {
        return sequence(relations);
    }).then(function () {
        return permissions.populate();
    }).then(function () {
        return Role.findOne({name: 'Owner'});
    }).then(function (ownerRole) {
        var user = fixtures.users[0];
        user.role = ownerRole.id;
        user.password = utils.uid(50);

        return User.add(user, {user: 1});
    });
};

// ### Update fixtures to 003
// Need to add client & owner role, then update permissions to 003 as well
to003 = function () {
    var ops = [],
        adminUser,
        Role = models.Role,
        Client = models.Client;

    // Add the new client fixture
    _.each(fixtures.client, function (client) {
        ops.push(function () { return Client.add(client); });
    });

    // Add the missing owner role
    _.each(fixtures.roles.slice(3), function (role) {
        ops.push(function () { return Role.add(role); });
    });

    return sequence(ops).then(function () {
        return permissions.to003();
    }).then(function () {
        return fetchAdmin();
    }).then(function (user) {
        adminUser = user;
        return Role.findOne({name: 'Owner'});
    }).then(function (ownerRole) {
        if (adminUser) {
            return adminUser.roles().updatePivot({role_id: ownerRole.id});
        }
    });
};

update = function (fromVersion, toVersion) {
    if (fromVersion < '003' && toVersion >= '003') {
        return to003();
    }
};

module.exports = {
    populate: populate,
    update: update
};
