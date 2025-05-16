import * as clarity from "./clarity";
import hash from "./core/hash";
import { get, getNode, lookup } from "./layout/dom";
import * as selector from "./layout/selector";

const helper = { hash, selector, get, getNode, lookup };
const version = clarity.version;

export { clarity, version, helper };
