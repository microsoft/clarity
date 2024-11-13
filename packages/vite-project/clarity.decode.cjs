'use strict';

var version$1 = "0.7.56";

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
var version = version$1;

function decode$5(tokens) {
    var time = tokens[0];
    var event = tokens[1];
    switch (event) {
        case 25 /* Data.Event.Ping */:
            var ping = { gap: tokens[2] };
            return { time: time, event: event, data: ping };
        case 35 /* Data.Event.Limit */:
            var limit = { check: tokens[2] };
            return { time: time, event: event, data: limit };
        case 24 /* Data.Event.Custom */:
            var custom = { key: tokens[2], value: tokens[3] };
            return { time: time, event: event, data: custom };
        case 3 /* Data.Event.Upgrade */:
            var upgrade = { key: tokens[2] };
            return { time: time, event: event, data: upgrade };
        case 2 /* Data.Event.Upload */:
            var upload = { sequence: tokens[2], attempts: tokens[3], status: tokens[4] };
            return { time: time, event: event, data: upload };
        case 0 /* Data.Event.Metric */:
            var m = 2; // Start from 3rd index since first two are used for time & event
            var metrics = {};
            while (m < tokens.length) {
                metrics[tokens[m++]] = tokens[m++];
            }
            return { time: time, event: event, data: metrics };
        case 1 /* Data.Event.Dimension */:
            var d = 2; // Start from 3rd index since first two are used for time & event
            var dimensions = {};
            while (d < tokens.length) {
                dimensions[tokens[d++]] = tokens[d++];
            }
            return { time: time, event: event, data: dimensions };
        case 36 /* Data.Event.Summary */:
            var s = 2; // Start from 3rd index since first two are used for time & event
            var summary = {};
            while (s < tokens.length) {
                var key = tokens[s++];
                var values = tokens[s++];
                summary[key] = [];
                for (var i = 0; i < values.length - 1; i += 2) {
                    summary[key].push([values[i], values[i + 1]]);
                }
            }
            return { time: time, event: event, data: summary };
        case 4 /* Data.Event.Baseline */:
            var baselineData = {
                visible: tokens[2],
                docWidth: tokens[3],
                docHeight: tokens[4],
                screenWidth: tokens[5],
                screenHeight: tokens[6],
                scrollX: tokens[7],
                scrollY: tokens[8],
                pointerX: tokens[9],
                pointerY: tokens[10],
                activityTime: tokens[11],
                scrollTime: tokens.length > 12 ? tokens[12] : null
            };
            return { time: time, event: event, data: baselineData };
        case 34 /* Data.Event.Variable */:
            var v = 2; // Start from 3rd index since first two are used for time & event
            var variables = {};
            while (v < tokens.length) {
                variables[tokens[v++]] = typeof tokens[v + 1] == "string" /* Constant.String */ ? [tokens[v++]] : tokens[v++];
            }
            return { time: time, event: event, data: variables };
        case 40 /* Data.Event.Extract */:
            var e = 2; // Start from 3rd index since first two are used for time & event
            var extract = {};
            while (e < tokens.length) {
                // For backward compatibility from version 0.7.4
                if (typeof (tokens[e + 1]) == "string" /* Constant.String */) {
                    extract[tokens[e++]] = tokens[e++];
                }
                else {
                    var key = tokens[e++];
                    var values = tokens[e++];
                    extract[key] = [];
                    for (var i = 0; i < values.length - 1; i += 2) {
                        extract[key][values[i]] = values[i + 1];
                    }
                }
            }
            return { time: time, event: event, data: extract };
    }
    return null;
}
function envelope(tokens) {
    return {
        version: tokens[0],
        sequence: tokens[1],
        start: tokens[2],
        duration: tokens[3],
        projectId: tokens[4],
        userId: tokens[5],
        sessionId: tokens[6],
        pageNum: tokens[7],
        upload: tokens[8],
        end: tokens[9]
    };
}

function decode$4(tokens) {
    var time = tokens[0];
    var event = tokens[1];
    switch (event) {
        case 31 /* Data.Event.ScriptError */:
            var scriptError = {
                message: tokens[2],
                line: tokens[3],
                column: tokens[4],
                stack: tokens[5],
                source: tokens[6]
            };
            return { time: time, event: event, data: scriptError };
        case 33 /* Data.Event.Log */:
            var log = {
                code: tokens[2],
                name: tokens[3],
                message: tokens[4],
                stack: tokens[5],
                severity: tokens[6]
            };
            return { time: time, event: event, data: log };
        case 41 /* Data.Event.Fraud */:
            var fraud = {
                id: tokens[2],
                target: tokens[3],
                checksum: tokens[4]
            };
            return { time: time, event: event, data: fraud };
    }
    return null;
}

function decode$3(tokens) {
    var time = tokens[0];
    var event = tokens[1];
    switch (event) {
        case 13 /* Data.Event.MouseDown */:
        case 14 /* Data.Event.MouseUp */:
        case 12 /* Data.Event.MouseMove */:
        case 15 /* Data.Event.MouseWheel */:
        case 16 /* Data.Event.DoubleClick */:
        case 17 /* Data.Event.TouchStart */:
        case 20 /* Data.Event.TouchCancel */:
        case 18 /* Data.Event.TouchEnd */:
        case 19 /* Data.Event.TouchMove */:
            var pointerData = {
                target: tokens[2],
                x: tokens[3],
                y: tokens[4],
                id: tokens[5],
            };
            return { time: time, event: event, data: pointerData };
        case 9 /* Data.Event.Click */:
            var clickHashes = tokens[12].split("." /* Data.Constant.Dot */);
            var clickData = {
                target: tokens[2],
                x: tokens[3],
                y: tokens[4],
                eX: tokens[5],
                eY: tokens[6],
                button: tokens[7],
                reaction: tokens[8],
                context: tokens[9],
                text: tokens[10],
                link: tokens[11],
                hash: clickHashes[0],
                hashBeta: clickHashes.length > 0 ? clickHashes[1] : null,
                trust: tokens.length > 13 ? tokens[13] : 1 /* Data.BooleanFlag.True */
            };
            return { time: time, event: event, data: clickData };
        case 38 /* Data.Event.Clipboard */:
            var clipData = { target: tokens[2], action: tokens[3] };
            return { time: time, event: event, data: clipData };
        case 11 /* Data.Event.Resize */:
            var resizeData = { width: tokens[2], height: tokens[3] };
            return { time: time, event: event, data: resizeData };
        case 27 /* Data.Event.Input */:
            var inputData = { target: tokens[2], value: tokens[3] };
            return { time: time, event: event, data: inputData };
        case 21 /* Data.Event.Selection */:
            var selectionData = {
                start: tokens[2],
                startOffset: tokens[3],
                end: tokens[4],
                endOffset: tokens[5]
            };
            return { time: time, event: event, data: selectionData };
        case 42 /* Data.Event.Change */:
            var changeData = {
                target: tokens[2],
                type: tokens[3],
                value: tokens[4],
                checksum: tokens[5]
            };
            return { time: time, event: event, data: changeData };
        case 39 /* Data.Event.Submit */:
            var submitData = {
                target: tokens[2]
            };
            return { time: time, event: event, data: submitData };
        case 10 /* Data.Event.Scroll */:
            var scrollData = {
                target: tokens[2],
                x: tokens[3],
                y: tokens[4],
                top: tokens.length > 5 ? tokens[5] : null,
                bottom: tokens.length > 6 ? tokens[6] : null
            };
            return { time: time, event: event, data: scrollData };
        case 22 /* Data.Event.Timeline */:
            var timelineHashes = tokens[3].split("." /* Data.Constant.Dot */);
            var timelineData = {
                type: tokens[2],
                hash: timelineHashes[0 /* Layout.Selector.Alpha */],
                x: tokens[4],
                y: tokens[5],
                reaction: tokens[6],
                context: tokens[7],
                hashBeta: timelineHashes.length > 0 ? timelineHashes[1 /* Layout.Selector.Beta */] : null
            };
            return { time: time, event: event, data: timelineData };
        case 28 /* Data.Event.Visibility */:
            var visibleData = { visible: tokens[2] };
            return { time: time, event: event, data: visibleData };
        case 26 /* Data.Event.Unload */:
            var unloadData = { name: tokens[2] };
            return { time: time, event: event, data: unloadData };
    }
    return null;
}

var AverageWordLength = 6;
var Space = " ";
function decode$2(tokens) {
    var time = tokens[0];
    var event = tokens[1];
    switch (event) {
        case 8 /* Data.Event.Document */:
            var documentData = { width: tokens[2], height: tokens[3] };
            return { time: time, event: event, data: documentData };
        case 7 /* Data.Event.Region */:
            var regionData = [];
            // From 0.6.15 we send each reach update in an individual event. This allows us to include time with it.
            // To keep it backward compatible (<= 0.6.14), we look for multiple regions in the same event. This works both with newer and older payloads.
            // In future, we can update the logic to look deterministically for only 3 fields and remove the for loop.
            var increment = void 0;
            for (var i = 2; i < tokens.length; i += increment) {
                var region = void 0;
                if (typeof (tokens[i + 2]) == "number" /* Constant.Number */) {
                    region = {
                        id: tokens[i],
                        interaction: tokens[i + 1],
                        visibility: tokens[i + 2],
                        name: tokens[i + 3]
                    };
                    increment = 4;
                }
                else {
                    var state = tokens[i + 1];
                    region = {
                        id: tokens[i],
                        // For backward compatibility before 0.6.24 - where region states were sent as a single enum 
                        // we convert the value into the two states tracked after 0.6.24
                        interaction: state >= 16 /* Interaction.None */ ? state : 16 /* Interaction.None */,
                        visibility: state <= 13 /* RegionVisibility.ScrolledToEnd */ ? state : 0 /* RegionVisibility.Rendered */,
                        name: tokens[i + 2]
                    };
                    increment = 3;
                }
                regionData.push(region);
            }
            return { time: time, event: event, data: regionData };
        case 45 /* Data.Event.StyleSheetAdoption */:
            var styleSheetAdoptionData = {
                id: tokens[2],
                operation: tokens[3],
                newIds: tokens[4]
            };
            return { time: time, event: event, data: styleSheetAdoptionData };
        case 46 /* Data.Event.StyleSheetUpdate */:
            var styleSheetUpdateData = {
                id: tokens[2],
                operation: tokens[3],
                cssRules: tokens[4]
            };
            return { time: time, event: event, data: styleSheetUpdateData };
        case 44 /* Data.Event.Animation */:
            var animationData = {
                id: tokens[2],
                operation: tokens[3],
                keyFrames: tokens[4],
                timing: tokens[5],
                timeline: tokens[6],
                targetId: tokens[7]
            };
            return { time: time, event: event, data: animationData };
        case 5 /* Data.Event.Discover */:
        case 6 /* Data.Event.Mutation */:
        case 43 /* Data.Event.Snapshot */:
            var lastType = null;
            var node = [];
            var tagIndex = 0;
            var domData = [];
            for (var i = 2; i < tokens.length; i++) {
                var token = tokens[i];
                var type = typeof (token);
                switch (type) {
                    case "number":
                        if (type !== lastType && lastType !== null) {
                            domData.push(process(node, tagIndex));
                            node = [];
                            tagIndex = 0;
                        }
                        node.push(token);
                        tagIndex++;
                        break;
                    case "string":
                        node.push(token);
                        break;
                    case "object":
                        var subtoken = token[0];
                        var subtype = typeof (subtoken);
                        switch (subtype) {
                            case "number":
                                for (var _i = 0, _a = token; _i < _a.length; _i++) {
                                    var t = _a[_i];
                                    node.push(tokens.length > t ? tokens[t] : null);
                                }
                                break;
                        }
                }
                lastType = type;
            }
            // Process last node
            domData.push(process(node, tagIndex));
            return { time: time, event: event, data: domData };
    }
    return null;
}
function process(node, tagIndex) {
    // For backward compatibility, only extract the tag even if position is available as part of the tag name
    // And, continue computing position in the visualization library from decoded payload.
    var tag = node[tagIndex] ? node[tagIndex].split("~")[0] : node[tagIndex];
    var output = {
        id: Math.abs(node[0]),
        parent: tagIndex > 1 ? node[1] : null,
        previous: tagIndex > 2 ? node[2] : null,
        tag: tag
    };
    var masked = node[0] < 0;
    var hasAttribute = false;
    var attributes = {};
    var value = null;
    for (var i = tagIndex + 1; i < node.length; i++) {
        // Explicitly convert the token into a string value
        var token = node[i].toString();
        var keyIndex = token.indexOf("=");
        var firstChar = token[0];
        var lastChar = token[token.length - 1];
        if (i === (node.length - 1) && output.tag === "STYLE") {
            value = token;
        }
        else if (output.tag !== "*T" /* Layout.Constant.TextTag */ && lastChar === ">" && keyIndex === -1) ;
        else if (output.tag !== "*T" /* Layout.Constant.TextTag */ && firstChar === "#" /* Layout.Constant.Hash */ && keyIndex === -1) {
            var parts = token.substr(1).split("." /* Layout.Constant.Period */);
            if (parts.length === 2) {
                output.width = num(parts[0]) / 100 /* Data.Setting.BoxPrecision */;
                output.height = num(parts[1]) / 100 /* Data.Setting.BoxPrecision */;
            }
        }
        else if (output.tag !== "*T" /* Layout.Constant.TextTag */ && keyIndex > 0) {
            hasAttribute = true;
            var k = token.substr(0, keyIndex);
            var v = token.substr(keyIndex + 1);
            attributes[k] = v;
        }
        else if (output.tag === "*T" /* Layout.Constant.TextTag */) {
            value = masked ? unmask(token) : token;
        }
    }
    if (hasAttribute) {
        output.attributes = attributes;
    }
    if (value) {
        output.value = value;
    }
    return output;
}
function num(input) {
    return input ? parseInt(input, 36) : null;
}
function unmask(value) {
    var trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.indexOf(Space) === -1) {
        var length_1 = num(trimmed);
        if (length_1 > 0) {
            var quotient = Math.floor(length_1 / AverageWordLength);
            var remainder = length_1 % AverageWordLength;
            var output = Array(remainder + 1).join("\u2022" /* Data.Constant.Mask */);
            for (var i = 0; i < quotient; i++) {
                output += (i === 0 && remainder === 0 ? "\u2022" /* Data.Constant.Mask */ : Space) + Array(AverageWordLength).join("\u2022" /* Data.Constant.Mask */);
            }
            return output;
        }
    }
    return value;
}

function decode$1(tokens) {
    var time = tokens[0];
    var event = tokens[1];
    switch (event) {
        case 29 /* Data.Event.Navigation */:
            var navigationData = {
                fetchStart: tokens[2],
                connectStart: tokens[3],
                connectEnd: tokens[4],
                requestStart: tokens[5],
                responseStart: tokens[6],
                responseEnd: tokens[7],
                domInteractive: tokens[8],
                domComplete: tokens[9],
                loadEventStart: tokens[10],
                loadEventEnd: tokens[11],
                redirectCount: tokens[12],
                size: tokens[13],
                type: tokens[14],
                protocol: tokens[15],
                encodedSize: tokens[16],
                decodedSize: tokens[17]
            };
            return { time: time, event: event, data: navigationData };
    }
    return null;
}

function decode(input) {
    var json = JSON.parse(input);
    var envelope$1 = envelope(json.e);
    var timestamp = Date.now();
    var payload = { timestamp: timestamp, envelope: envelope$1 };
    // Sort encoded events by time to simplify summary computation
    // It's possible for individual events to be out of order, dependent on how they are buffered on the client
    // E.g. scroll events are queued internally before they are sent over the wire.
    // By comparison, events like resize & click are sent out immediately.
    var encoded = json.p ? json.a.concat(json.p) : json.a;
    encoded = encoded.sort(function (a, b) { return a[0] - b[0]; });
    // Check if the incoming version is compatible with the current running code
    // We do an exact match for the major version and minor version.
    // For patch, we are backward and forward compatible with up to version change.
    var jsonVersion = parseVersion(payload.envelope.version);
    var codeVersion = parseVersion(version);
    if (jsonVersion.major !== codeVersion.major ||
        Math.abs(jsonVersion.minor - codeVersion.minor) > 1) {
        throw new Error("Invalid version. Actual: ".concat(payload.envelope.version, " | Expected: ").concat(version, " (+/- 1) | ").concat(input.substr(0, 250)));
    }
    for (var _i = 0, encoded_1 = encoded; _i < encoded_1.length; _i++) {
        var entry = encoded_1[_i];
        switch (entry[1]) {
            case 4 /* Data.Event.Baseline */:
                if (payload.baseline === undefined) {
                    payload.baseline = [];
                }
                payload.baseline.push(decode$5(entry));
                break;
            case 25 /* Data.Event.Ping */:
                if (payload.ping === undefined) {
                    payload.ping = [];
                }
                payload.ping.push(decode$5(entry));
                break;
            case 35 /* Data.Event.Limit */:
                if (payload.limit === undefined) {
                    payload.limit = [];
                }
                payload.limit.push(decode$5(entry));
                break;
            case 3 /* Data.Event.Upgrade */:
                if (payload.upgrade === undefined) {
                    payload.upgrade = [];
                }
                payload.upgrade.push(decode$5(entry));
                break;
            case 0 /* Data.Event.Metric */:
                if (payload.metric === undefined) {
                    payload.metric = [];
                }
                var metric = decode$5(entry);
                // It's not possible to accurately include the byte count of the payload within the same payload
                // The value we get from clarity-js lags behind by a payload. To work around that,
                // we increment the bytes from the incoming payload at decode time.
                metric.data[2 /* Data.Metric.TotalBytes */] = input.length;
                payload.metric.push(metric);
                break;
            case 1 /* Data.Event.Dimension */:
                if (payload.dimension === undefined) {
                    payload.dimension = [];
                }
                payload.dimension.push(decode$5(entry));
                break;
            case 36 /* Data.Event.Summary */:
                if (payload.summary === undefined) {
                    payload.summary = [];
                }
                payload.summary.push(decode$5(entry));
                break;
            case 24 /* Data.Event.Custom */:
                if (payload.custom === undefined) {
                    payload.custom = [];
                }
                payload.custom.push(decode$5(entry));
                break;
            case 34 /* Data.Event.Variable */:
                if (payload.variable === undefined) {
                    payload.variable = [];
                }
                payload.variable.push(decode$5(entry));
                break;
            case 2 /* Data.Event.Upload */:
                if (payload.upload === undefined) {
                    payload.upload = [];
                }
                payload.upload.push(decode$5(entry));
                break;
            case 13 /* Data.Event.MouseDown */:
            case 14 /* Data.Event.MouseUp */:
            case 12 /* Data.Event.MouseMove */:
            case 15 /* Data.Event.MouseWheel */:
            case 16 /* Data.Event.DoubleClick */:
            case 17 /* Data.Event.TouchStart */:
            case 20 /* Data.Event.TouchCancel */:
            case 18 /* Data.Event.TouchEnd */:
            case 19 /* Data.Event.TouchMove */:
                if (payload.pointer === undefined) {
                    payload.pointer = [];
                }
                payload.pointer.push(decode$3(entry));
                break;
            case 9 /* Data.Event.Click */:
                if (payload.click === undefined) {
                    payload.click = [];
                }
                var clickEntry = decode$3(entry);
                payload.click.push(clickEntry);
                break;
            case 38 /* Data.Event.Clipboard */:
                if (payload.clipboard === undefined) {
                    payload.clipboard = [];
                }
                var clipEntry = decode$3(entry);
                payload.clipboard.push(clipEntry);
                break;
            case 10 /* Data.Event.Scroll */:
                if (payload.scroll === undefined) {
                    payload.scroll = [];
                }
                payload.scroll.push(decode$3(entry));
                break;
            case 11 /* Data.Event.Resize */:
                if (payload.resize === undefined) {
                    payload.resize = [];
                }
                payload.resize.push(decode$3(entry));
                break;
            case 21 /* Data.Event.Selection */:
                if (payload.selection === undefined) {
                    payload.selection = [];
                }
                payload.selection.push(decode$3(entry));
                break;
            case 42 /* Data.Event.Change */:
                if (payload.change === undefined) {
                    payload.change = [];
                }
                var changeEntry = decode$3(entry);
                payload.change.push(changeEntry);
                break;
            case 39 /* Data.Event.Submit */:
                if (payload.submit === undefined) {
                    payload.submit = [];
                }
                var submitEntry = decode$3(entry);
                payload.submit.push(submitEntry);
                break;
            case 22 /* Data.Event.Timeline */:
                if (payload.timeline === undefined) {
                    payload.timeline = [];
                }
                payload.timeline.push(decode$3(entry));
                break;
            case 27 /* Data.Event.Input */:
                if (payload.input === undefined) {
                    payload.input = [];
                }
                payload.input.push(decode$3(entry));
                break;
            case 26 /* Data.Event.Unload */:
                if (payload.unload === undefined) {
                    payload.unload = [];
                }
                payload.unload.push(decode$3(entry));
                break;
            case 28 /* Data.Event.Visibility */:
                if (payload.visibility === undefined) {
                    payload.visibility = [];
                }
                payload.visibility.push(decode$3(entry));
                break;
            case 37 /* Data.Event.Box */:
                /* Deprecated - Intentionally, no-op. For backward compatibility. */
                break;
            case 7 /* Data.Event.Region */:
                if (payload.region === undefined) {
                    payload.region = [];
                }
                payload.region.push(decode$2(entry));
                break;
            case 5 /* Data.Event.Discover */:
            case 6 /* Data.Event.Mutation */:
            case 43 /* Data.Event.Snapshot */:
            case 45 /* Data.Event.StyleSheetAdoption */:
            case 46 /* Data.Event.StyleSheetUpdate */:
            case 44 /* Data.Event.Animation */:
                if (payload.dom === undefined) {
                    payload.dom = [];
                }
                payload.dom.push(decode$2(entry));
                break;
            case 8 /* Data.Event.Document */:
                if (payload.doc === undefined) {
                    payload.doc = [];
                }
                payload.doc.push(decode$2(entry));
                break;
            case 31 /* Data.Event.ScriptError */:
                if (payload.script === undefined) {
                    payload.script = [];
                }
                payload.script.push(decode$4(entry));
                break;
            case 33 /* Data.Event.Log */:
                if (payload.log === undefined) {
                    payload.log = [];
                }
                payload.log.push(decode$4(entry));
                break;
            case 41 /* Data.Event.Fraud */:
                if (payload.fraud === undefined) {
                    payload.fraud = [];
                }
                payload.fraud.push(decode$4(entry));
                break;
            case 29 /* Data.Event.Navigation */:
                if (payload.navigation === undefined) {
                    payload.navigation = [];
                }
                payload.navigation.push(decode$1(entry));
                break;
            case 30 /* Data.Event.Connection */:
            case 32 /* Data.Event.ImageError */:
                /* Deprecated - Intentionally, no-op. For backward compatibility. */
                break;
            case 40 /* Data.Event.Extract */:
                if (payload.extract === undefined) {
                    payload.extract = [];
                }
                payload.extract.push(decode$5(entry));
                break;
            default:
                console.error("No handler for Event: ".concat(JSON.stringify(entry)));
                break;
        }
    }
    return payload;
}
function parseVersion(ver) {
    var output = { major: 0, minor: 0, patch: 0, beta: 0 };
    var parts = ver.split(".");
    if (parts.length === 3) {
        var subparts = parts[2].split("-b");
        output.major = parseInt(parts[0], 10);
        output.minor = parseInt(parts[1], 10);
        if (subparts.length === 2) {
            output.patch = parseInt(subparts[0], 10);
            output.beta = parseInt(subparts[1], 10);
        }
        else {
            output.patch = parseInt(parts[2], 10);
        }
    }
    return output;
}

exports.decode = decode;
