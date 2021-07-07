'use strict';
const conf = require( './config' );
const request = require( 'request-promise' );
let debug = conf.debug;
let headers = {
    'Content-Type': 'application/json',
};

let username = "", password = "", hostname = "";
process.argv.forEach( (val, index, arr) => {
    if( val === '-u' )
        username = process.argv[index+1];
    if( val === '-p' )
        password = process.argv[index+1];
    if( val === '-h' )
        hostname = process.argv[index+1];
} );
if( username === "" )
    username = conf.plesk_host.login_data.user;
if( password === "" )
    password = conf.plesk_host.login_data.password;
if( hostname === "" )
    hostname = conf.plesk_host.hostname


let auth =  'Basic ' + Buffer.from( username + ":" + password ).toString( 'base64' );
headers['Authorization'] = auth;

console.log( "Trying to log in on '" + hostname + "' as '" + username + "' with password '" + password + "'..." );

request({
    url: 'https://' + hostname + ':8443/api/v2/domains',
    headers: headers
}).then( response1 => {
    let domains = JSON.parse( response1 );   
    domains.forEach( domain => {
        if( domain.hosting_type != "virtual" || domain.name.includes( '*' ) )
            return;
        if( conf.whitelisted_urls.includes( domain.name ) ) {
            if( debug )
                console.log( "Domain " + domain.name + " is on the whitelist, skipping..." );
            return;
        }
        request( {
            url: 'https://' + hostname + ':8443/api/v2/domains/' + domain.id + '/status',
            headers: headers
        } ).then( response2 => {
            let status = JSON.parse( response2 );
            domain.status = status.status;
            if( debug )
                console.log( "Domain{id=" + domain.id + ",name=" + domain.name + ",hosting_type=" + domain.hosting_type + ",status=" + domain.status + "}" );
            if( domain.status !== 'active' )
                return;
            request( { url: 'http://' + domain.name } ).then( response3 => {
                if( debug )
                    console.log( "Domain " + domain.name + " successfully accessed!" );
            }).catch( error => console.log( "Domain " + domain.name + " cannot be accessed, please check! Error-Code: ", error.statusCode != null ? error.statusCode : error.error.errno ) );
        } ).catch( error => console.log( "Error while fetching status for domain " + domain.name, debug ?  ( " -> " + error ) : error.statusCode ) );
    } );
}).catch( error => console.log( "Error while fetching domains: ", debug ?  error : error.statusCode ) );