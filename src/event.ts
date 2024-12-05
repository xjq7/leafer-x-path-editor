import { IUI, IEventTarget } from '@leafer-ui/interface';
import { Event } from '@leafer-ui/core';

interface IPathEditorEvent {
  readonly target?: IUI;
  readonly value?: IUI | IUI[];
  readonly oldValue?: IUI | IUI[];
}

export class PathEditorEvent extends Event {
  static CHANGE = 'pathEditor.change';

  declare readonly target: IEventTarget;

  readonly value: IUI;
  readonly oldValue: IUI;

  constructor(type: string, data?: IPathEditorEvent) {
    super(type);
    if (data) Object.assign(this, data);
  }
}
