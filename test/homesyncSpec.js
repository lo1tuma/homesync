'use strict';

var referee = require('referee'),
    sinon = require('sinon'),
    refereeSinon = require('referee-sinon'),
    proxyquire = require('proxyquire'),
    homedir = sinon.stub(),
    ignore = sinon.stub(),
    stubs = {
        homedir: homedir,
        ignore: ignore
    },
    homesync = proxyquire('../lib/homesync', stubs),
    fs = require('fs'),
    path = require('path'),
    Promise = require('bluebird'),
    expect = referee.expect;

refereeSinon(referee, sinon);

describe('homesync', function () {
    var addIgnoreFile,
        ignoreFilter,
        exampleHomeDirectory = '/Users/anyUser',
        currentWorkingDirectory = '/example';

    beforeEach(function () {
        var ignoreInstance = {};

        addIgnoreFile = sinon.stub().returns(ignoreInstance);
        ignoreFilter = sinon.stub();

        ignoreInstance.addIgnoreFile = addIgnoreFile;
        ignoreInstance.filter = ignoreFilter;

        ignore.returns(ignoreInstance);

        homedir.returns(exampleHomeDirectory);

        sinon.stub(path, 'resolve', path.join);
        sinon.stub(fs, 'readdirAsync');
        sinon.stub(fs, 'lstatAsync');
        sinon.stub(fs, 'symlinkAsync');
        sinon.stub(fs, 'existsAsync').returns(Promise.resolve());
        sinon.stub(fs, 'unlinkAsync');

        sinon.stub(process, 'cwd').returns(currentWorkingDirectory);
    });

    afterEach(function () {
        homedir.reset();
        ignore.reset();
        path.resolve.restore();
        fs.readdirAsync.restore();
        fs.lstatAsync.restore();
        fs.symlinkAsync.restore();
        fs.existsAsync.restore();
        fs.unlinkAsync.restore();
        process.cwd.restore();
    });

    it('should create symlinks of all files in the home directory', function (done) {
        var directoryEntries = [
            'foo',
            'bar.json'
        ];

        fs.readdirAsync.returns(Promise.resolve(directoryEntries));
        ignoreFilter.returns(directoryEntries);
        fs.lstatAsync.withArgs('/example/folderToSync/foo').returns(Promise.resolve({ isDirectory: sinon.stub().returns(true) }));
        fs.lstatAsync.withArgs('/example/folderToSync/bar.json').returns(Promise.resolve({ isDirectory: sinon.stub().returns(false) }));

        homesync('/folderToSync')
            .then(function () {
                expect(fs.readdirAsync).toHaveBeenCalledOnce();
                expect(fs.readdirAsync).toHaveBeenCalledWithExactly('/example/folderToSync');

                expect(ignoreFilter).toHaveBeenCalledWithExactly(directoryEntries);

                expect(path.resolve).toHaveBeenCalledThrice();
                expect(fs.lstatAsync).toHaveBeenCalledTwice();
                expect(fs.lstatAsync).toHaveBeenCalledWithExactly('/example/folderToSync/foo');
                expect(fs.lstatAsync).toHaveBeenCalledWithExactly('/example/folderToSync/bar.json');

                expect(fs.symlinkAsync).toHaveBeenCalledTwice();
                expect(fs.symlinkAsync).toHaveBeenCalledWithExactly('/example/folderToSync/foo', '/Users/anyUser/foo', 'dir');
                expect(fs.symlinkAsync).toHaveBeenCalledWithExactly('/example/folderToSync/bar.json', '/Users/anyUser/bar.json', 'file');
            })
            .done(done, done);
    });

    it('should overwrite existing symlinks', function (done) {
        var directoryEntries = [ 'foo' ];

        fs.readdirAsync.returns(Promise.resolve(directoryEntries));
        ignoreFilter.returns(directoryEntries);
        fs.lstatAsync.withArgs('/example/folderToSync/foo').returns(Promise.resolve({ isDirectory: sinon.stub().returns(true) }));
        fs.lstatAsync.withArgs('/Users/anyUser/foo').returns(Promise.resolve({ isSymbolicLink: sinon.stub().returns(true) }));
        fs.existsAsync.withArgs('/Users/anyUser/foo').returns(Promise.reject());

        homesync('/folderToSync')
            .then(function () {
                expect(fs.existsAsync).toHaveBeenCalledOnce();
                expect(fs.existsAsync).toHaveBeenCalledWithExactly('/Users/anyUser/foo');
                expect(fs.lstatAsync).toHaveBeenCalledWithExactly('/Users/anyUser/foo');

                expect(fs.unlinkAsync).toHaveBeenCalledOnce();
                expect(fs.unlinkAsync).toHaveBeenCalledWithExactly('/Users/anyUser/foo');
            })
            .done(done, done);
    });

    it('should reject if a file already exists which is not a symlink', function (done) {
        var directoryEntries = [ 'foo' ],
            expectedErrorMessage = '/Users/anyUser/foo already exists and is not a symlink';

        fs.readdirAsync.returns(Promise.resolve(directoryEntries));
        ignoreFilter.returns(directoryEntries);
        fs.lstatAsync.withArgs('/example/folderToSync/foo').returns(Promise.resolve({ isDirectory: sinon.stub().returns(true) }));
        fs.lstatAsync.withArgs('/Users/anyUser/foo').returns(Promise.resolve({ isSymbolicLink: sinon.stub().returns(false) }));
        fs.existsAsync.withArgs('/Users/anyUser/foo').returns(Promise.reject());

        homesync('/folderToSync')
            .catch(function (error) {
                expect(error.message).toEqual(expectedErrorMessage);
            })
            .done(done, done);
    });

});
