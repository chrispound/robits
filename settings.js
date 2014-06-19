window.settings = _.extend({
    soundEffectsOn: true,
    musicOn: true,
    updateSetting: function(name, value) {
        settings[name] = value;
        localStorage[name] = value;
    }
}, localStorage);