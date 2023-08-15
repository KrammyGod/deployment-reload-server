module.exports = {
    apps : [{
        name         : 'reload-server',
        script       : 'index.js',
        instances    : 1,
        watch        : ['index.js'],
        watch_delay  : 1000,
        cron_restart : '0 10 */2 * *'
    }]
};
