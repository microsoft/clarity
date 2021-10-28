import * as clarity from "./clarity";
import hash from "./core/hash";
import selector from "./layout/selector";
import { get, getNode, lookup } from "./layout/dom";

const helper = { hash, selector, get, getNode, lookup }
const version = clarity.version;

export { clarity, version, helper };
