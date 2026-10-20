import {mkdir,readFile,readdir,copyFile,rm,open} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {atomicJSON,runLectureJob} from './lecture-pipeline.js';
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
export class LectureJobs {
  constructor(root,{runner=runLectureJob}={}){this.root=root;this.runner=runner;this.jobs=new Map();this.queue=[];this.running=false;this.closing=false;this.deleteAfterRun=new Set();}
  dir(id){if(!validId(id))throw Object.assign(Error('Job not found.'),{status:404});return join(this.root,id);}
  async init(){
    await mkdir(this.root,{recursive:true,mode:0o700});
    this.lockPath=join(this.root,'worker.lock');
    try{this.lock=await open(this.lockPath,'wx',0o600);}catch(error){
      if(error.code!=='EEXIST')throw error;
      const owner=JSON.parse(await readFile(this.lockPath,'utf8'));
      let alive=true;try{process.kill(owner.pid,0);}catch(check){if(check.code==='ESRCH')alive=false;else throw check;}
      if(alive)throw Error('Another Lecture Condenser server is using this job folder. Stop the other server before starting this one.');
      await rm(this.lockPath);this.lock=await open(this.lockPath,'wx',0o600);
    }
    await this.lock.writeFile(JSON.stringify({pid:process.pid}));
    for(const id of await readdir(this.root)){
      if(!validId(id))continue;
      let job;
      try{job=JSON.parse(await readFile(join(this.dir(id),'job.json'),'utf8'));}catch(error){
        if(error.code==='ENOENT'){await rm(this.dir(id),{recursive:true,force:true});continue;}
        console.error(`Could not restore lecture job ${id}: metadata is unreadable. Files were preserved.`);continue;
      }
      if(job.id!==id)throw Error('Invalid saved job metadata.');
      this.jobs.set(id,job);
      if(['running','queued'].includes(job.status)){
        job.status='queued';job.message='Resuming from saved checkpoints after a server restart.';await this.save(job);this.queue.push(id);
      }
    }
    this.wake();return this;
  }
  async save(job){job.updatedAt=new Date().toISOString();await atomicJSON(join(this.dir(job.id),'job.json'),job);}
  get(id){this.dir(id);const job=this.jobs.get(id);if(!job)throw Object.assign(Error('Job not found.'),{status:404});return job;}
  public(id){const {files,...job}=this.get(id);return {...job,fileNames:files.map(file=>file.originalname)};}
  async create(files){
    const id=randomUUID(),dir=this.dir(id);await mkdir(dir,{mode:0o700});
    const job={id,status:'queued',stage:'queued',message:'Queued for processing.',createdAt:new Date().toISOString(),files:[]};
    try{
      for(let i=0;i<files.length;i++){const file=files[i],storedName=`input-${i}`;await copyFile(file.path,join(dir,storedName));job.files.push({originalname:file.originalname,size:file.size,storedName});}
      await this.save(job);this.jobs.set(id,job);this.queue.push(id);this.wake();return this.public(id);
    }catch(error){await rm(dir,{recursive:true,force:true});throw error;}
  }
  async retry(id){
    const job=this.get(id);if(!['failed'].includes(job.status))throw Object.assign(Error('Only failed jobs can be retried.'),{status:409});
    job.status='queued';job.error=null;job.message='Queued to resume from saved checkpoints.';await this.save(job);this.queue.push(id);this.wake();return this.public(id);
  }
  wake(){if(!this.running&&!this.closing)this.pumpPromise=this.pump().catch(error=>console.error('Lecture worker stopped: '+error.message));}
  async shutdown(){this.closing=true;this.controller?.abort();await this.pumpPromise;await this.lock?.close();await rm(this.lockPath,{force:true});}
  async pump(){
    if(this.running)return;this.running=true;
    try{
      while(this.queue.length&&!this.closing){
        const id=this.queue.shift(),job=this.get(id);if(job.status!=='queued')continue;
        this.activeId=id;this.controller=new AbortController();job.status='running';
        try{
          await this.save(job);
          const result=await this.runner(job,this.dir(id),{signal:this.controller.signal,update:async patch=>{Object.assign(job,patch);await this.save(job);}});
          this.controller.signal.throwIfAborted();
          Object.assign(job,{status:'completed',stage:'completed',message:'Your complete study guide is ready.',result,error:null,nextRetryAt:null});await this.save(job);
          // Only the final job/result remains after success. Failed jobs keep resumable material.
          for(const name of await readdir(this.dir(id)))if(name!=='job.json')await rm(join(this.dir(id),name),{recursive:true,force:true});
        }catch(error){
          job.status=this.closing?'queued':this.controller.signal.aborted?'cancelled':'failed';job.error=job.status==='failed'?error.message:null;job.message=job.error||(this.closing?'Paused for server restart.':'Processing cancelled.');job.nextRetryAt=null;
          await this.save(job);
        }
        this.activeId=null;this.controller=null;
        if(job.status==='cancelled'||this.deleteAfterRun.has(id)){this.deleteAfterRun.delete(id);await this.erase(id);}
      }
    }finally{this.running=false;}
  }
  async erase(id){await rm(this.dir(id),{recursive:true,force:true});this.jobs.delete(id);}
  async remove(id){
    this.get(id);
    if(this.activeId===id){this.deleteAfterRun.add(id);this.controller.abort();return {status:'cancelling'};}
    this.queue=this.queue.filter(queued=>queued!==id);await this.erase(id);return {status:'deleted'};
  }
}
