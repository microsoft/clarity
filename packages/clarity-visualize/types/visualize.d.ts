import { Data, Layout } from "clarity-decode";


export type ResizeHandler  = (width: number, height: number) => void;

export interface MergedPayload {
    timestamp: number;
    envelope: Data.Envelope;
    dom: Layout.DomEvent;
    events: Data.DecodedEvent[];
}

export interface Point {
    time: number;
    x: number;
    y: number;
}

export interface Options {
    version: string;
    dom?: Layout.DomEvent;
    onresize?: ResizeHandler;
    metadata?: HTMLElement;
    canvas?: boolean;
    keyframes?: boolean;
}

export interface PlaybackState {
    window: Window;
    options: Options;
}

export type Activity = ElementData[];

export interface ScrollMapInfo {
    scrollReachY: number;
    cumulativeSum: number;
    percUsers: number;
}

export interface RegionState {
    interactionState: Layout.Interaction,
    visibilityState: Layout.RegionVisibility
 }

export interface ElementData {
    hash: string;
    selector: string;
    totalclicks: number;
    x: number[];
    y: number[];
    clicks: number[];
    points: number;
}

export interface Heatmap {
    x: number; /* X Coordinate */
    y: number; /* Y Coordinate */
    a: number; /* Alpha */
}

export const enum NodeType {
    ELEMENT_NODE = 1,
    ATTRIBUTE_NODE = 2,
    TEXT_NODE = 3,
    COMMENT_NODE = 8,
    DOCUMENT_NODE = 9,
    DOCUMENT_TYPE_NODE = 10
}

export const enum Asset {
    Pointer = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAmCAYAAAA4LpBhAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAASDSURBVHgB7VdPTCNlFH8z0/+FFmRatnFNiDGR4O4mBk08smZvXjjIxRueNME9eHGNxoLxSNwr4WyigYToQRJLjXDzQtDNmnhR4kWWAJm20ymddtrx94bvI9NBWAptsod9ycvM92fe73vv/b73fUP0DIlCfRQ1AMTtjwcHB1+gPgOT67oK6+TkZBjNbxRF+X1gYCCDPpX6IKdGAaTu7++HuG9tbe1ONBr9GR7r+Xy+98DsIRuemJiIjI6OJgH+3e7urruzs+OOjIw8SiaTNwRwz8OtQWPpdHoYoKt///ar2/jxaw84k8k8gt5YWVnRqEfi90BrtVph0Uetx0V67d9fqFAo3G6324XZ2VldLK4noK4AVqvVaoh8YZTAxWLxdiwW20CoM70IdceWicfjSpCxfuBEIrGxsLCQZR7QNcQDwFaRRhRmcXCSL9S3kN8CtlP2Oqz2QoWt4Q4NDanHx8cy3HQBMIe6sLS0pF811B7I5uYmhUKh1nmAQWAOteM4xcXFxczMzEzXHp+u9PDwUBHvymWBmVzr6+t6t9tJhtPzEEYuFaoguebm5nTqJOXFoMxEVCO50tMFXBaYcwwbGwAfRagv5bEKthK2igdUr9epG/EDYw//xKGmzoLz/6BQd3t7m5i9dAUJsJoLSPZp5PIGp6amXHjsVSaEirqVALk8jy/axx2hwAcMTlcRH/Ad5LfA24kEZ4JzudbySSJzyqDnomq37pH14utH/iUrCA5HCeRwHYXc8dzNNs5jfXp6uoD+e/Pz8zzfDYIqq6urihg4NyTaK2/Rw8fNo0/euWvBWI3TwGAiHW2RnjY7LRVjX+7t7d3nSWL8FFSKIj46I0r2ZXr4R/PoQT5f1TTtU3Q5OAbbbAxtV4BwXx07wUI5raJdTaVS5vLysmYYhlyMDJBHJBoeHpbFwQ0CfmuP04P8V1VVVb9AVwXGy/xE6SyHw2FuW9Aa2jYAHVx1HAZh78bGxs44wYkm0zS9PPrC1QE4+8HcPwD8HONPYNzEkAU1UX+raFcYmPswzhu9ISLmShIdHBx0lFfVH2s+SyWR/IBofgYvnmCIPTQjkYiBk8mARwYWU4aW8F5uNpslXHkstBncxjcOeyqJ6vfUO9oQd2avlyeKJj3A9z/8yAOE7uHKUgGoiRQYMFZCdEq2bZfgpYFnmd9xzprlcrnCOdV13cbWaWKezGVnAUBOmVBpkOAlPH/AxuYJu/DoPQDcxfubeB/ncZCDL+IpaDKgiVwul8AzDo1BI3RC1HPLIg+mYPQmvPke+hdY+S68ehuevIHQvYpV5/i2KIxKg5pUUew1AaL6wM4cl4oPFJjxFMJ0H6BbIIgBwAbeLSzABLBVKpVszGvSCf27r5dCNE7h1tYWX1U0ECHUaDT+REhryKENrTFbwdLj+skRxIAeM+ka4rGV2QWv2vCIjVoAryC0Jk6MCk6fGvoY0OkFoF80UDsG8AG8j/BtD78YWRSMNNoJQbSe/1Zw0tmwBB6kE0ZG+wXI4v1ECYAIdbKzf/+povypEui6t/jnwvIf5FVJ1Cj/1+UAAAAASUVORK5CYII=",
    Click = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAmCAYAAAA4LpBhAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAVoSURBVHgB7VdNTCRFGP2qe6aBGRhA5mfJ7kZcV0XQTQx68MYabl44yMWbetAY3IMX12gWMCZeSLwSEi/GiAHF1SjqMAhoshuTJbg/GkM0xMQIBMj8D/Nfvq+6enZmEtFdhsSDRT66q6qnXr33varqJvoPFUHHWIw6IK6/2tbWdg8dMzBJKQXHwMCAG9UPhBDXW1tbA2gz6BhKZVAAGTs7Oy5um5+fP9fU1LQExv6xsbHGAzNDHrivr88KhUJegH+0ubkp19fXZVdX1w2v13tCAzdcbhPR3N7e3gnQuY0ry3L7nRcUcCAQuIE4MTs7a1IDi9CgXuQxCNBPNq6uyF+HWuTO5IvVjEP6uSMXlk1qYCOVSnFOgYvRLUtmVmbp9HfvUSQSebS5uXkRwIFGSF2zZFpaWoTtWEHCcgvDclPm+4/p3qvvK2CPx7M4MTERZB/QEYoCxVJxBhHsYvwn0+2WKiyLslc+pfuufSjD4fAjyG+Y03AUVyupsDRkR0eHcXBwYMuNKQi3BaYIt5uYce6Hz8XZ63MMzFKHp6am/HcrtQJZWVkhl8tVIju/KqkmgBxAdQXr3LUv6exPl5XUxWIxMjk5GRgZGbljxpWZ7u3tCX3PPCuALDEYk2Ytij9+RQ9ufFEx18LCgv9Ol5PjXsUQg9hSsXubLA3IwC7JoVgjSjfD9PDm1xVzjY6O+qnWlIeDshOxGzkzVRNgeW2mdl6FfXVkxiQsKv/8LfX9sUScY4yxCPAQpP5XjA0GwFJRTLPZrG5mUFcln6Ytc+Uq0CdcLgAvyf4/lxUw1vA3LDVVpexQedfW1ojdW2m1N4cKM8PllqLKUMI0SRhCsuVKtyLUv7XsuJo3kOA/mUt1Dg4OsqRqZ4JUPJZtIttAaqMAMzQarH8NCzwqSzcjghlrcynGh63jGinwA5VP9efIaBr2vqgBnGeltH+nJonCjPts4HPIb5iXE2nP1IPyXssniZNTBhVq0RhC3p6QTd/oHxLpk4/t356yelQawijrecnek6fKOI/9w8PDYQw1ND4+zs/LelAxNzcndIdRLRwzs5kIYT7wJL17q7D/2tPn0+jIcDunRDMt6/SUmbQT6Htra2vrAj+k+yugFRT9I6qVEGxCZwCY3784dillmubr6CqWSqUyD4a61CDclsVKSGM7TaGe8vl8yenpaTMajTqTqeSUjUSdnZ3O5iCrYUXwDM1ke+ni2NspwzAuoTGBweN8xdYZd7vdXE8jMqjnAFjEq06RQZhdT08P1RdONCWTSaEFdeSyqQfvFzO5XnrupdHfAfgm+rcxeBJdaUQS+28K9QQDcxv6eaHntWLSMdHu7q6zxWorVGnNZ6nQVmVJmSEDovoGWGyjixkmLcuK4mSKglEUk4kjYriPFwqFGF550qgzeA6/KTJTx6jVTNXRBt3ZvSpP1OSlmYNeev7lVxQgYqtcLicAmkQKohgsBnViuVwuBpZRXON8j3M2GY/HE5xTv9+fw9Ip4DknlzXAnFM2VDtMcBrXz7Cw+YFNMHoWAOdx/wTue7kf5uAXcR/CWxee7u5uD64tiGaERbZR/3Zb5E4fBj0FNpcRv8GVz4DVU2DyOKR7CLPu5rdFPagzoOmE3uxNDWJUgYl6UFEFCswWH2S6ANBVGCQKwDzu05hAEsDpWCyWw3MFsu0v6S6LySlcXV3lVxUTRnDl8/lfIGkGOcwhMuxWuPQgax9BDKicSUcoyq3sLrAqgxEPmgZ4AtImcWIkcPpk0MaAxUYAVhcT1m4GeCvuu/htD58YQWwY7ah7tNEa/lnBSeeBHeA2sh3ZdFyAXNRHlAawqNadx/edqrc/wwE66lv8/4XLX3gjac6XP/Y1AAAAAElFTkSuQmCC",
    Sound = "data:video/webm;base64,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",
    Transparent = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    Hide = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANvSURBVHgB7Ve9VhpREJ5dU6BNVqt0wS6dpEuX9QmiTyA+gfgE4BOgZSrJE4hlKvEJxDKVa2caoaSSfB87F4Z7dtmFhFTMOfcMe52Z+935u6PIhjb0dxTIihRFUQ2M6z0/dXuI9ay8PwTJklQaEADw0JMgCI4USFSkMx6Pe2BdrFtgS6QEFQICjirYGYDUc0AMcXCCvw8XAVVwHQD7IasAokfCMGzB0NmCA1o44N7T+wpwlwouT+80z2NbOWAaMHqDn7FuJcorapRATkej0bOvyz2s7zs7O2L0GbYXrCrscjUqlUoAuZ6vH3hAIr3diW4xHC3wW+w/KZhLgDmXEgRzbR6udvbBD/DdITB3UewfWm+FRpnIHwyYLo1A+Aq/vzkDWFdSni4krTjm1RnDOxgM9nFOS//OM++0YmeAFMydQw4gDSgeu7LVyprE3489je3u7t5waQFMifrQ6ehn7PZfX18v6BkFOwcq9MDQQKxeseRu0PXARJprBHxED2t7sPSol6p5YHs467OkXo8cqBA/rmXmmVO/atzZzk4G0Kond+DJJJLmStc3Sm+rpxLVbYcEoRu8xbWNp9U1B1rqyzzIRNQj5tAe84ZVKVmGZ6BoK5Vh2JADT1hjLny3rBL27nS/7RtUXZdDmb1H5Ug1rDgjrFMKrGGb2CzPt7e3C95gb2+vqeU/1Mor/UZpg21og50CsfYzATllsLY+E6TE60OTPoUqOV8EQNKKmuTTgifHAmO4GOokyDFah2BTTAOTNFcmIQFI3qyVoxurp+dIL3ZF72bYdzL1zKcDLb2P1n4rqUfcg/nB3Cre3t6uQeY3ZBOri72q87B7ULHY035CdmTs85H9BVlR23yWumVf+6YJo0/MK7qcI8al9RCqq9R4w4ICq9JDYZEwk44ly2TWFtGT+VKnF2PwB6cis8sUzkw+vSsrqNXQ0eUmxo+S5gEPfvQBSTpNLjU1rjzCLiKEYAAWMQRFA5m2GzdJxIUhW5H6yutFguhRToapcb8WQGwL5MwtDnt5cvQOZJuq0yHfkjUQWwHbAn5+AqgvKHGW/IsPRquR+ZdgcQIdrStkYh5tN1ocZYCpSto2Dqezl6yRMga/yQSpXToyYFzOrReQAcUhzp8E+E4eWzD/lTgxuPFGR5Wlm+Y/J3qL/7fJhja0RvoDR4Tn4Lo/zi8AAAAASUVORK5CYII=",
    Unavailable = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAiCAYAAAAge+tMAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAU6SURBVHgBzVg7TyNJEG6bh5AIjpOQeCXj7LL18pDIdpztRYuzy7CjCzG/ADu8CO8vwEQXrgkvws6QeNiEFzEk4GznIFnxvO/zVntrhx6/kLxb0mh6uqurvq6urqqehHklra+ve3d3dx8SiUT6+fk5ja4ZtGf4tjzoD9AXoBmiXUsmk+cnJyc18wpKmCFodXXVx8t/enraBCDPDEchniqeg9PT06oZkAYCTsCw2A6afjc+8IQCjGR3oBtxR/bHx8crR0dHgemD+gIugPfQ9OJ4BGwF72qj0ajrsTQI7rEFcDnTndoLeHh4KDebzdAMC5z+e39/T8B+Nz6AbcJtslAWdOMDfg8LONTuJf7vRVgDPEW40H6crLG4AVi58Pj4+Deav0WUFIjBfDt8NYD+HaBbpge1Wq1wbm5uH+DXjewe5IXQ85buxAMurJS9sbi46IG/jnlforKS0Q7f92dWVlYOAXLXgqMb4CmcnZ2l8E5YpVwIlGZ7basm8nIO50qXNzY29g6y8+hP0RCKPYexBne+K3Ay3N7eNoxyDViziicFwR+la8uOwULFQUBr8LB6XgOU/gDukcGittUY3bUBY25oGR0fX1tbSwPgoVFWxquoAFufv5DxgDvgAsZdu7m52WR7cnLyIC5SAMxnqw+6PRzqSzvmOg9coPX7ZAzoAN9vNWgSQKfVpzP2yq5dQGGZD61F+S5e6KnYNkD6eozWBwZav6m6K1hs2yBJB2hGiIwrQmDsjfp8MS6L2zMqa7INebvGTedKthcdtODN90Yi+I2kCO0owsq3e4U1EqOBq98FwNWnxgKCgd66a5znAe6RjYDfGsdJzmtfgqBPWFE+Jg2HSmFcNuS8QqSv5mLkwQewiumDBKcn87JJ5UuB8BDQJ8TxYnQyFnep2ukYMCXzvXUY57ddvIOGUeIUNw47UQWneEYsrwFVJiYmSjYqkAdx9bOMMR6n4pSTF7J+0ZHCRVKwfaA7SXUZ0g3xNJn+j4+Pm655L1L+8vLyrmRHS4FR6ZfJyUichyKGy5IZgvot2EA1GC8fDanOWgXgCwBPodqPqxCwjQKIljmUPiaSTJxVuoAuCui+CXhKqOGLne84xpgEQKqoSwMpwIIy/ZajUdBytspSVV6KblaT79AsaP0afM+yFtbP4bXT48LAWqYEtymbHrIgZy/SnYurAsV4O7ocRjvD21Nf9bgIYMbK9VgAq8f2rYYHbHp6OqjVau3DK+UCXcw1P9ethI2cO9YzqYFuQLIA3/TegTYxpbPqE+UdazM7o82suWn6AC8Rr2F10upjZgBiPX19fd3E83F+fr5mviakKQiad/FDWfHq6upftlFbM0N7AvwP1kHoY5Fmzwrr7wCyzx16vywsLBDwe9s31GU5ShKz30gOmLGWQZwv2fIBYfRZ2JnCf7Vz0V8xyvIsaV1nReeQ9oXGjIDoYlB6IZ811tx6PAo+Gvoswd0urFGS5icgLCSHV8e/GS5dJYemUQHXxZnnYugFXtzRzg1HApz1jC3iqFzqkxfUDTxcTc9pDhRVXkOICrSYb78RPQ5cfOivRqKNv7S0lMAi/lTRqziSw0mSqMADauufbLdfb45ir032rjsyi0ssnlJWfw/Ltlxxm4T+fyR2+7qfi+GckQEXMHWA9c3XRDRl5KcPXOE/JKrA8vEvwezsLH8a5YwqEWDtMqz9F9sjcxVL4jJM/RuRoVB+iZjob2qSgO7cpEYO3BJrfry2etU8XAx4XtyBfxhwki3aAGyT9b39HS3/KJsoGSr4rLuuh/8DlPszm7LNbUUAAAAASUVORK5CYII=",
    Cross = 'data:image/svg+xml,<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%"><rect width="100%" height="100%" style="fill:rgb(204,204,204)"/><line stroke-dasharray="5, 5"  x1="0" y1="100%" x2="100%" y2="0" style="stroke:rgb(119,119,119);stroke-width:1"/><line stroke-dasharray="5, 5"  x1="0" y1="0" x2="100%" y2="100%" style="stroke:rgb(119,119,119);stroke-width:1"/><circle cx="50%" cy="50%" r="40" fill="rgb(204,204,204)"/></svg>',
}

export const enum Constant {
    ClarityPrefix = "clarity-",
    Canvas = "CANVAS",
    HeatmapCanvas = "clarity-heatmap-canvas",
    InteractionCanvas = "clarity-interaction-canvas",
    UnknownTag = "clarity-unknown",
    ImageTag = "img",
    IFrameTag = "iframe",
    AltAttribute = "alt",
    Hover = ":hover",
    CustomHover = "clarity-hover",
    Region = "clarity-region",
    AdoptedStyleSheet = "clarity-adopted-style",
    Id = "data-clarity-id", 
    Hash = "data-clarity-hash",
    Hide = "data-clarity-hide",
    Unavailable = "data-clarity-unavailable",
    Suspend = "data-clarity-suspend",
    Hidden = "hidden",
    Visible = "visible",
    None = "none",    
    Small = "s",
    Medium = "m",
    Large = "l",
    Dom = "dom",
    Context = "2d",
    Pixel = "px",    
    Separator = "X",
    Absolute = "absolute",
    Black = "black",
    Transparent = "transparent",
    HiddenOpacity = "0.4",
    VisibleOpacity = "1",
    ClickLayer = "clarity-click",
    PointerLayer = "clarity-pointer",
    TouchLayer = "clarity-touch",
    HoverAttribute = "clarity-hover",
    PointerClickLayer = "clarity-pointer-click",
    PointerNone = "clarity-pointer-none",
    PointerMove = "clarity-pointer-move",
    ClickRing = "clarity-click-ring",
    TouchRing = "clarity-touch-ring",
    Title = "title",
    Round = "round",
    AverageFold = "Average Fold",
    Empty = "",
    Undefined = "undefined",
    Function = "function",
    FormTag = "form",
    AutoComplte = "autocomplete",
    Off = "off"
}

export const enum Setting {
    Medium = 200,
    Small = 75,
    Radius = 20,
    AlphaBoost = 0.15,
    Colors = 256,
    Interval = 30,
    ZIndex = 2147483647, // Max integer value
    PointerWidth = 29,
    PointerHeight = 38,
    PointerOffset = 4,
    ClickRadius = 22,
    PixelLife = 3000,
    TrailWidth = 6,
    MaxTrailPoints = 75,
    HoverDepth = 7,
    MaxHue = 240,
    MarkerLineHeight = 1,
    MarkerHeight = 32,
    MarkerMediumWidth = 84,
    MarkerRange = 2,
    MarkerSmallWidth = 35,
    MarkerPadding = 5,
    MarkerColor = "white",
    CanvasTextColor = "#323130",
    CanvasTextFont = "500 12px Segoe UI",
    ScrollCanvasMaxHeight = 40000
}
