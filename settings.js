_.mixin({ mapValues: function (obj, f_val) {
    return _.object(_.keys(obj), _.map(obj, f_val));
}});

window.settings = _.merge({
    soundEffectsOn: true,
    musicOn: false,
    updateSetting: function(name, value) {
        settings[name] = value;
    },
    save: function() {
        _.each(settings, function(value, key) {
           if(!_.isFunction(value)) {
               if(_.isUndefined(value)) {
                   localStorage.removeItem(key);
               } else {
                   localStorage[key] = JSON.stringify(value);
               }
           }
        });
    }
}, hud.defaultSettings);

// Load local storage into settings
for ( var i = 0; i < localStorage.length; i++ ) {
    var key = localStorage.key(i);
    var storedValue = localStorage.getItem(localStorage.key(i));
    var parsedValue;
    try {
        parsedValue = JSON.parse(storedValue);
    } catch(e) {
        parsedValue = storedValue;
    }
    settings[key] = parsedValue;
}