export function setCookie(cname, cvalue) {
    const d = new Date();
    d.setTime(d.getTime() + (1*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

export function deleteCookie(cname) {
    const d = new Date();
    d.setTime(d.getTime() - (100*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=;" + expires + ";path=/";
}

export function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
        c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
        }
    }
    return null;
}

export function lerpBackground(color1, color2, interpolateLengthSeconds, interpolateFrameTimeMilliseconds) {
    let interpolateTimer = 0;
    const interpolateFunc = (() => {
        // If we're under the interpolate length, get this frame's color, set it, and continue to next loop
        if ((interpolateTimer / 1000) < interpolateLengthSeconds) {
            document.body.style.backgroundColor = interpolateColor(color1, color2, interpolateTimer / (interpolateLengthSeconds * 1000));
            interpolateTimer += interpolateFrameTimeMilliseconds;
            setTimeout(interpolateFunc, interpolateFrameTimeMilliseconds);
        // If we're pas the interpolate length, set background color to final color
        } else {
            document.body.style.backgroundColor = color2;
        }
    });
    interpolateFunc();
}

function interpolateColor(color1, color2, percent) {
    // Convert the hex colors to RGB values
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);
  
    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);
  
    // Interpolate the RGB values
    const r = Math.round(r1 + (r2 - r1) * percent);
    const g = Math.round(g1 + (g2 - g1) * percent);
    const b = Math.round(b1 + (b2 - b1) * percent);
  
    // Convert the interpolated RGB values back to a hex color
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }