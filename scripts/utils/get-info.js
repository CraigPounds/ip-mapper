import GoogleMap from '../utils/google-maps-wrapper.js';
import { data } from '../data/data.js';

/**
 * Get user IP through webkitRTCPeerConnection
 * @param onNewIP {Function} listener function to expose IP locally
 * @return undefined
 */
function findPrivateIP(onNewIP) {
  // Compatibility for Chrome & Firefox
  let myPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  let pc = new myPeerConnection({
      iceServers: []
    }),
    noop = function () { },
    localIPs = {},
    ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g,
    key;
  
  function iterateIP(ip) {
    
    if (!localIPs[ip]) onNewIP(ip);
    localIPs[ip] = true;
  }
  // Create bogus data channel
  pc.createDataChannel('');
  // Create offer and set local description
  pc.createOffer().then(function (sdp) {
    sdp.sdp.split('\n').forEach(function (line) {
      if (line.indexOf('candidate') < 0) return;
      line.match(ipRegex).forEach(iterateIP);
    });
    pc.setLocalDescription(sdp, noop, noop);
  }).catch(function (reason) {
    // Handle failure to connect
    $('txtInput').value = 'reason';
  });
  // Listen for candidate events
  pc.onicecandidate = function (ice) {
    if (!ice || !ice.candidate || !ice.candidate.candidate || !ice.candidate.candidate.match(ipRegex)) return;
    ice.candidate.candidate.match(ipRegex).forEach(iterateIP);
  };
}

function getDNS(ip) {
  $.getJSON(`https://api.shodan.io/dns/reverse?ips=${ip}&key=3ebsORr9MVlM1QSAQb4Xs0L1mh82xCKw`, function(response) {
    data.dns = response[Object.keys(response)[0]];
  });
}

function getIP(ip) {  
  const QUERY = `https://ipapi.co/${ip}/json/`;
  $.getJSON(QUERY, ipCallBack);  
}

function getLocalConnectionInfo() {
  
  if (navigator.connection) {
    navigator.connection.addEventListener('change', saveNetworkInfo);
    function saveNetworkInfo() {
      // Bandwidth estimate
      data.downloadSpeed = navigator.connection.downlink;
      // Round-trip time estimate
      data.rtt = navigator.connection.rtt;
      // Effective connection type determined using recently observed rtt and downlink values
      data.effectiveType = navigator.connection.effectiveType;
    }
    saveNetworkInfo();
  }
}

function getLocalInfo() {
  getPrivateIP();
  getIP('');
  getUserLocation();
  getLocalConnectionInfo();
}

function getPrivateIP() {
  
  if (/*@cc_on!@*/false || !!document.documentMode || window.navigator.userAgent.indexOf('Edge') > -1) {
    // Edge & IE
    data.privateIP = 'Not supported by this browser';
  }
  else {
    findPrivateIP(function(ip) {
      data.privateIP = ip;
    });
  }
}

function getUserLocation() {

  if (navigator.geolocation) {
    /* Local network information used by Google Location Services to estimate location includes information about visible WiFi access points, including signal strength &information about your local router, computer's IP address */ 
    navigator.geolocation.getCurrentPosition(function (position) {
      data.privateLat = position.coords.latitude;
      data.privateLng = position.coords.longitude;

      GoogleMap.addMarker({ lat: data.privateLat, lng: data.privateLng });
      GoogleMap.map.setZoom(6);
      GoogleMap.map.setCenter({ lat: data.privateLat, lng: data.privateLng });
      
      $('#start').prop('disabled', false);
    }, geolocationError);
  } else {
    $('#start').prop('disabled', false);   
    console.log('Geolocation not supported.');
  }  
}

function geolocationError(error) {
  $('#start').prop('disabled', false);
  switch (error.code) {
  case error.PERMISSION_DENIED:
    console.log('Request for Geolocation denied.');
    break;
  case error.POSITION_UNAVAILABLE:
    console.log('Location information is unavailable.');
    break;
  case error.TIMEOUT:
    console.log('The request to get user location timed out.');
    break;
  case error.UNKNOWN_ERROR:
    console.log('An unknown error occurred.');
    break;
  } 
}

function ipCallBack(response) {
  if (data.ipSearches.length < 1) {
    data.publicIP = response.ip;
    data.publicLat = response.latitude;
    data.publicLng = response.longitude;
    getDNS(data.publicIP);
  }
  data.ipSearches.push(response);
}

export { getLocalInfo };