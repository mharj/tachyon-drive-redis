import {createClient, RedisClientOptions, RedisFunctions, RedisModules, RedisScripts} from '@redis/client';
import {IPersistSerializer, IStoreProcessor, StorageDriver} from 'tachyon-drive';
import {commandOptions} from '@redis/client/dist/lib/command-options';
import {ILoggerLike} from '@avanio/logger-like';

type RedisOptions = RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>;
type RedisClient = ReturnType<typeof createClient>;

type RedisOptionsOrProvider = RedisOptions | Promise<RedisOptions> | (() => RedisOptions | Promise<RedisOptions>);

export class RedisStorageDriver<Input> extends StorageDriver<Input, Buffer> {
	private options: RedisOptionsOrProvider;
	private redis: RedisClient | undefined;
	private key: string;

	/**
	 * RedisStorageDriver constructor
	 * @param name - name of the driver
	 * @param key - key to use for storage
	 * @param options - redis client options
	 * @param serializer - tachyon serializer to use
	 * @param processor - tachyon processor to use (default: undefined)
	 * @param logger - logger to use (default: undefined)
	 */
	constructor(
		name: string,
		key: string,
		options: RedisOptionsOrProvider,
		serializer: IPersistSerializer<Input, Buffer>,
		processor?: IStoreProcessor<Buffer>,
		logger?: ILoggerLike | Console,
	) {
		super(name, serializer, processor, logger);
		this.options = options;
		this.key = key;
	}

	protected async handleInit(): Promise<boolean> {
		return Boolean(await this.getDriver());
	}

	protected async handleStore(buffer: Buffer): Promise<void> {
		await (await this.getDriver()).hSet(this.key, 'value', buffer);
	}

	protected async handleHydrate(): Promise<Buffer | undefined> {
		const data = await (await this.getDriver()).hGetAll(commandOptions({returnBuffers: true}), this.key);
		return data?.value;
	}

	protected async handleClear(): Promise<void> {
		await (await this.getDriver()).del(this.key);
	}

	protected async handleUnload(): Promise<boolean> {
		if (this.redis) {
			await this.redis.quit();
			this.redis = undefined;
		}
		return true;
	}

	private async getDriver(): Promise<RedisClient> {
		if (!this.redis) {
			this.redis = createClient(await this.getOptions());
			await this.redis.connect();
		}
		return this.redis;
	}

	private getOptions(): RedisOptions | Promise<RedisOptions> {
		return typeof this.options === 'function' ? this.options() : this.options;
	}
}
