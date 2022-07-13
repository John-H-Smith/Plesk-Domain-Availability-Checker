'use strict';
const conf = require( './config' );
const prompt = require( 'prompt' );
const colors = require( 'colors/safe' );
const fetch = require( 'node-fetch' );
const https = require( 'https' );
let debug = conf.debug;
let headers = {
    'Content-Type': 'application/json',
};
let props = { properties: {} };
prompt.message = "";
prompt.delimiter = colors.cyan( ':' );
let username = "", password = "", hostname = "";
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

(async () => {
    try {
        await getLoginData();
        loadData();
    } catch( error ) {}
} )();


async function getLoginData() {

    hostname = conf.plesk_host.hostname;
    username = conf.plesk_host.login_data.user;
    password = conf.plesk_host.login_data.password;
    
    process.argv.forEach( (val, index, arr) => {
        if( val === '-h' )
            hostname = process.argv[index+1];
        if( val === '-u' )
            username = process.argv[index+1];
        if( val === '-p' )
            password = process.argv[index+1];
        if( val === '-d' )
            debug = true;
    } );      
    
    if( hostname === "" )
        props.properties.host = { description: colors.cyan( 'Hostname' ), required: true, };

    if( username === "" )
        props.properties.user = { description: colors.cyan( 'Username' ), required: true, default: 'root' };

    if( password === "" )
        props.properties.pass = { description: colors.cyan( 'Password' ), hidden: true, required: true };

    if( props.properties != {} ) {
        prompt.start();
        let { host, user, pass } = await prompt.get( props );

        if( host )
            hostname = host;
        if( user )
            username = user;
        if( pass )
            password = pass;
    }
}

function loadData() {
    let auth =  'Basic ' + Buffer.from( username + ":" + password ).toString( 'base64' );
    headers['Authorization'] = auth;
    
    console.log( "Trying to log in on '" + hostname + "' as '" + username + "'..." );
    
    fetch( 'https://' + hostname + ':8443/api/v2/domains', { headers: headers, agent: httpsAgent } )
        .then( res => res.json() )
        .then( response1 => { 
            if( response1.code === 0 ) {
                console.log( "Error while connecting: ", response1.message );
                return;
            }
            response1.forEach( domain => {
                if( domain.hosting_type != "virtual" || domain.name.includes( '*' ) )
                    return;
                if( conf.whitelisted_urls.includes( domain.name ) ) {
                    if( debug )
                        console.log( "Domain " + domain.name + " is on the whitelist, skipping..." );
                    return;
                }

                fetch( 'https://' + hostname + ':8443/api/v2/domains/' + domain.id + '/status', { headers: headers, agent: httpsAgent } )
                    .then( res => res.json() )
                    .catch( err => console.log( err ) )
                    .then( response2 => {

                        domain.status = response2.status;
                        if( debug )
                            console.log( "Domain{id=" + domain.id + ",name=" + domain.name + ",hosting_type=" + domain.hosting_type + ",status=" + domain.status + "}" );
                        if( domain.status !== 'active' )
                            return;

                        fetch( "http://" + domain.name )
                            .then( res => res.text() )
                            .then( body => { if( debug ) console.log( "Domain " + domain.name + " successfully accessed!" ) } )
                            .catch( error => console.log( "Domain " + domain.name + " cannot be accessed, please check! Error-Code: ", error.statusCode != null ? error.statusCode : error.errno ) );
                    })
                    .catch( error => console.error( "Error while fetching status for domain " + domain.name, debug ?  ( " -> ", error ) : "(" + error.code + ")" ) );
            } );
        })
        .catch( error => console.log( "Error while fetching domains: ", debug ?  error : error.statusCode ) );
}