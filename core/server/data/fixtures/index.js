var sequence    = require('when/sequence'),
    _           = require('lodash'),
    utils       = require('../../utils'),
    models      = require('../../models'),
    fixtures    = require('./fixtures'),
    permissions = require('./permissions'),

    populateFixtures,
    updateFixtures;

populateFixtures = function () {
    var ops = [],
        relations = [],
        Post = models.Post,
        Tag = models.Tag,
        Role = models.Role,
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

    _.each(fixtures.client003, function (client) {
        ops.push(function () {return Client.add(client, {user: 1}); });
    });

    // add the tag to the post
    relations.push(function () {
        return Post.forge({id: 1}).fetch({withRelated: ['tags']}).then(function (post) {
            return post.tags().attach([1]);
        });
    });

    return sequence(ops).then(function () {
        return sequence(relations);
    }).then(function () {
        return permissions.populatePermissions();
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
        adminUser,
        Role = models.Role,
        Client = models.Client,
        User = models.User;

    _.each(fixtures.client003, function (client) {
        ops.push(function () {return Client.add(client, {user: 1}); });
    });

    _.each(fixtures.roles003, function (role) {
        ops.push(function () {return Role.add(role, {user: 1}); });
    });

    return sequence(ops).then(function () {
        return permissions.updatePermissions();
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
