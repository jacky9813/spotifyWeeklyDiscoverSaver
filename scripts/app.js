window.onmessage = function(e){
    if(typeof(e.data) == "object"){
        if(typeof(e.data.hash.state) == "string"){
            app.states[e.data.hash.state](e.data)
            delete app.states[e.data.hash.state];
        } else if(typeof(e.data.search.state) == "string"){
            app.states[e.data.search.state](e.data)
            delete app.states[e.data.search.state];
        }
    }
}

var app = {spotify: {access_token:"","token_type":""},
states: {},
localization: {}
};

/**
 * @param {function} callback
 * 
 * @returns {string}
 */
app.registerState = function(callback){
    var state = Math.random().toString(36).substring(2);
    app.states[state] = callback;
    return state;
}

app.objectToURLSearchParams = function(param, oldData = ""){
    var usp = new URLSearchParams(oldData);
    if(typeof(param) == "object")    
        for(key in param)
            usp.append(key, param[key]);
    return usp;
}

app.spotify.authorize = function(callback){
    var authData = {
        client_id: "3745a0d5599f4ad699afb25d9a48adec",
        response_type: "token",
        redirect_uri:"https://jacky9813.github.io/spotifyWeeklyDiscoverSaver/callback.html",
        scope: "playlist-read-private playlist-modify-public playlist-modify-private",
        state: app.registerState(function(data){
            setTimeout(function(){
                app.spotify.authorize();
            }, (parseInt(data.hash.expires_in) - 20) * 1000);
            app.spotify.access_token = data.hash.access_token;
            app.spotify.token_type = data.hash.token_type;
            if(typeof(callback) == "function"){
                callback();
            }
        })
    }
    var param = new URLSearchParams();
    Object.keys(authData).forEach(function(k){
        param.set(k, authData[k]);
    })
    var url = "https://accounts.spotify.com/authorize?"+param.toString();

    window.open(url,"_blank","menubar=0")
}

app.spotify.findPlaylist = function(name){
    if(app.spotify.access_token != null && app.spotify.access_token.trim() != "")
        return new Promise(function(resolve, reject){
            var param = app.objectToURLSearchParams({
                q: name,
                type:"playlist"
            }).toString()
            var xhr = new XMLHttpRequest();
            xhr.addEventListener("readystatechange",function(ev){
                if(ev.target.readyState == 4){
                    if(parseInt(ev.target.status/100) == 2){
                        try{
                            resolve(JSON.parse(ev.target.responseText).playlists.items[0]);
                        } catch(e){
                            reject(e);
                        }
                    } else {
                        reject(ev.target.status);
                    }
                }
            });
            xhr.addEventListener("error",function(ev){
                reject(ev);
            })
            xhr.open("GET","https://api.spotify.com/v1/search?"+param);
            xhr.setRequestHeader("Authorization", app.spotify.token_type + " " + app.spotify.access_token);
            xhr.send();
        });
}

app.spotify.getPlaylistTracks = function(id){
    if(app.spotify.access_token != null && app.spotify.access_token.trim() != "" && typeof(id) == "string" && id.trim() != "")
        return new Promise(function(resolve,reject){
            var xhr = new XMLHttpRequest();
            xhr.addEventListener("readystatechange",function(ev){
                if(ev.target.readyState == 4){
                    if(parseInt(ev.target.status/100) == 2){
                        try{
                            resolve(JSON.parse(ev.target.responseText).items);
                        }catch(e){
                            reject(e);
                        }
                    } else {
                        reject(ev.target.status);
                    }
                }
            })
            xhr.addEventListener("error",function(ev){reject(ev);})
            xhr.open("GET","https://api.spotify.com/v1/playlists/" + id.trim() + "/tracks")
            xhr.setRequestHeader("Authorization", app.spotify.token_type + " " + app.spotify.access_token);
            xhr.send();
        });
}

/**
 * @param {string} name - The name of the playlist
 * @param {string[]} items - The initial items that goes into the playlist, must be an array of Spotify URI (spotify:track:trackID)
 */
app.spotify.newPlaylist = function(name, items = []){
    if(app.spotify.access_token != null && app.spotify.access_token.trim() != "")
        return new Promise(function(resolve, reject){
            // Get user ID
            var xhr_userId = new XMLHttpRequest();
            xhr_userId.addEventListener("readystatechange",function(ev){
                if(ev.target.readyState == 4){
                    if(parseInt(ev.target.status/100) == 2){
                        try{
                            var userData = JSON.parse(ev.target.responseText);
                        } catch(e){
                            reject(e);
                        }
                        var xhr_createPlaylist = new XMLHttpRequest();
                        xhr_createPlaylist.addEventListener("readystatechange",function(ev){
                            if(ev.target.readyState == 4){
                                if(parseInt(ev.target.status/100) == 2){
                                    try{
                                        var playlistData = JSON.parse(ev.target.responseText)
                                    } catch(e){
                                        reject(e);
                                    }
                                    if(playlistData.href != null){
                                        var xhr_itemAdd = new XMLHttpRequest();
                                        var regex = new RegExp(/[^:]*:[^:]*:[^:]*/);
                                        xhr_itemAdd.addEventListener("readystatechange",(function(playlistData){return function(ev){
                                            if(ev.target.readyState == 4){
                                                if(parseInt(ev.target.status / 100) == 2){
                                                    resolve(playlistData);
                                                } else {
                                                    reject(ev.target);
                                                }
                                            }
                                        }})(playlistData));
                                        xhr_itemAdd.open("POST",playlistData.href + "/tracks");
                                        xhr_itemAdd.setRequestHeader("Authorization", app.spotify.token_type + " " + app.spotify.access_token);
                                        xhr_itemAdd.setRequestHeader("Content-Type","application/json");
                                        xhr_itemAdd.send(JSON.stringify({uris:items.filter(el => regex.test(el))}))
                                    }
                                } else {
                                    reject(ev.target.status);
                                }
                            }
                        })
                        xhr_createPlaylist.addEventListener("error",function(ev){reject(ev)});
                        xhr_createPlaylist.open("POST","https://api.spotify.com/v1/users/"+userData.id+"/playlists");
                        xhr_createPlaylist.setRequestHeader("Authorization", app.spotify.token_type + " " + app.spotify.access_token);
                        xhr_createPlaylist.setRequestHeader("Content-Type","application/json");
                        xhr_createPlaylist.send(JSON.stringify({name:name}));
                    } else {
                        reject(ev.target.status);
                    }
                }
            });
            xhr_userId.addEventListener("error",function(ev){reject(ev);});
            xhr_userId.open("GET","https://api.spotify.com/v1/me");
            xhr_userId.setRequestHeader("Authorization", app.spotify.token_type + " " + app.spotify.access_token);
            xhr_userId.send();
        });
}
app.localization.getLocale = function(locale, callback){
    var css = document.createElement("link");
    css.setAttribute("rel","stylesheet");
    css.setAttribute("href","localization/" + navigator.language + ".css");
    document.head.append(css);
}