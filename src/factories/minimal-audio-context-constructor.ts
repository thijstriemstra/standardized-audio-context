import { createInvalidStateError } from '../factories/invalid-state-error';
import { isValidLatencyHint } from '../helpers/is-valid-latency-hint';
import { IAudioContextOptions, IMinimalAudioContext } from '../interfaces';
import { TMinimalAudioContextConstructorFactory, TUnpatchedAudioContext } from '../types';

export const createMinimalAudioContextConstructor: TMinimalAudioContextConstructorFactory = (
    minimalBaseAudioContextConstructor,
    unpatchedAudioContextConstructor
) => {

    return class MinimalAudioContext extends minimalBaseAudioContextConstructor implements IMinimalAudioContext {

        private _state: null | 'suspended';

        private _unpatchedAudioContext: TUnpatchedAudioContext;

        constructor (options: IAudioContextOptions = {}) {
            if (unpatchedAudioContextConstructor === null) {
                throw new Error(); // @todo
            }

            const unpatchedAudioContext = new unpatchedAudioContextConstructor(options);

            // Bug #51 Only Chrome and Opera throw an error if the given latencyHint is invalid.
            if (!isValidLatencyHint(options.latencyHint)) {
                throw new TypeError(
                    `The provided value '${ options.latencyHint }' is not a valid enum value of type AudioContextLatencyCategory.`
                );
            }

            super(unpatchedAudioContext, unpatchedAudioContext.destination.channelCount);

            this._state = null;
            this._unpatchedAudioContext = unpatchedAudioContext;

            /*
             * Bug #34: Chrome and Opera pretend to be running right away, but fire an onstatechange event when the state actually
             * changes to 'running'.
             */
            if (unpatchedAudioContext.state === 'running') {
                this._state = 'suspended';

                const revokeState = () => {
                    if (this._state === 'suspended') {
                        this._state = null;
                    }

                    if (unpatchedAudioContext.removeEventListener) {
                        unpatchedAudioContext.removeEventListener('statechange', revokeState);
                    }
                };

                unpatchedAudioContext.addEventListener('statechange', revokeState);
            }
        }

        public get state () {
            return (this._state !== null) ? this._state : this._unpatchedAudioContext.state;
        }

        public close () {
            // Bug #35: Firefox does not throw an error if the AudioContext was closed before.
            if (this.state === 'closed') {
                return this._unpatchedAudioContext
                    .close()
                    .then(() => {
                        throw createInvalidStateError();
                    });
            }

            // Bug #34: If the state was set to suspended before it should be revoked now.
            if (this._state === 'suspended') {
                this._state = null;
            }

            return this._unpatchedAudioContext.close();
        }

        public resume () {
            return this._unpatchedAudioContext
                .resume()
                .catch((err) => {
                    // Bug #55: Chrome, Edge and Opera do throw an InvalidAccessError instead of an InvalidStateError.
                    // Bug #56: Safari invokes the catch handler but without an error.
                    if (err === undefined || err.code === 15) {
                        throw createInvalidStateError();
                    }

                    throw err;
                });
        }

        public suspend () {
            return this._unpatchedAudioContext
                .suspend()
                .catch((err) => {
                    // Bug #56: Safari invokes the catch handler but without an error.
                    if (err === undefined) {
                        throw createInvalidStateError();
                    }

                    throw err;
                });
        }

    };

};
