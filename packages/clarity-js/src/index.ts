import * as clarity from "./clarity";
import hash from "./core/hash";
import { decodeMaskedText } from "./core/scrub";
import * as selector from "./layout/selector";
import { get, getNode, lookup } from "./layout/dom";

const helper = { hash, selector, get, getNode, lookup }
const version = clarity.version;

export { clarity, version, helper, decodeMaskedText };
