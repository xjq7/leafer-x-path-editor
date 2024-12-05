import { IEventTarget, IUI } from '@leafer-ui/interface';
import { Event } from '@leafer-ui/core';

interface IPathEditorEvent {
    readonly target?: IUI;
    readonly value?: IUI | IUI[];
    readonly oldValue?: IUI | IUI[];
}
declare class PathEditorEvent extends Event {
    static CHANGE: string;
    readonly target: IEventTarget;
    readonly value: IUI;
    readonly oldValue: IUI;
    constructor(type: string, data?: IPathEditorEvent);
}

export { PathEditorEvent };
