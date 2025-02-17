import { Component, Input, OnInit, TemplateRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { AdoptionReceivedModel } from 'src/app/shared/models/adoption-received-model';
import { AnimalModel } from 'src/app/shared/models/animal-model';
import { PersonModel } from 'src/app/shared/models/person-model';
import { AdoptionService } from 'src/app/shared/services/adoption.service';
import { AnimalService } from 'src/app/shared/services/animal.service';
import { LocalstorageService } from 'src/app/shared/services/localstorage.service';
import { environment } from 'src/environments/environment';

@Component({
  templateUrl: './show-animal.component.html',
  styleUrls: ['./show-animal.component.less']
})
export class ShowAnimalComponent implements OnInit {

  @Input() animal: AnimalModel | undefined;
  animalShow: AnimalModel = new AnimalModel();
  modalRef?: BsModalRef;
  selectedPhoto: string = '';
  loggedPerson: boolean = false;
  adotionRequestCreated: AdoptionReceivedModel | undefined;
  personData: PersonModel | undefined;
  formBlockAnimal: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private routerService: Router,
    private storage: LocalstorageService,
    private animalService: AnimalService,
    private adoptionService: AdoptionService,
    private toast: ToastrService,
    private modalService: BsModalService,
  ) {
    this.formBlockAnimal = this.createFormBlockAnimal();
  }

  ngOnInit(): void {
    if (this.animal == undefined) {
      const id = this.route.snapshot.paramMap.get('id');
      if (id != null && isNaN(Number.parseInt(id)) == false) {
        const animalId = Number.parseInt(id);
        this.getAnimalFromDatabase(animalId);
      } else {
        this.notFoundRedirect();
      }
    } else {
      this.animalShow = this.animal;
      this.verifyLoggedPerson();
    }
  }

  ownerImage(): string {
    const image = this.animalShow.owner?.image;
    if (image != undefined) {
      return `/server${image}`;
    }
    return '/assets/images/person.png';
  }

  createFormBlockAnimal(): FormGroup {
    return new FormGroup({
      reason: new FormControl('', [Validators.required]),
    });
  }

  get formIsValid(): boolean {
    return this.formBlockAnimal.valid;
  }

  getAnimalFromDatabase(id: number) {
    this.animalService.getAimalsByID(id).subscribe(
      (data: AnimalModel) => {
        this.animalShow = data;
        this.verifyLoggedPerson();
      },
      error => this.verifyStatusError(error),
    );
  }

  get animalImage(): string {
    if (this.animalShow!.all_photos.length == 0) {
      if (this.animalShow?.animal_type == 'Cachorro') {
        return '/assets/images/adopt-dog.png';
      } else if (this.animalShow?.animal_type == 'Gato') {
        return '/assets/images/adopt-cat.png';
      } else {
        return '/assets/images/cat-dog.png';
      }
    }
    return environment.API + this.animalShow!.all_photos[0].photo;
  }

  verifyLoggedPerson() {
    if (this.storage.userIsLogged()) {
      this.loggedPerson = true;
      this.personData = this.storage.getLoggedPersonData();
      this.verifyAdoptionRequestCreated();
    }
  }

  verifyAdoptionRequestCreated() {
    this.adoptionService.loggedPersonAdoptionsCreated().subscribe(
      (data: AdoptionReceivedModel[]) => {
        for (const adoptionRequest of data) {
          if (adoptionRequest.animal == this.animalShow.id) {
            this.adotionRequestCreated = adoptionRequest;
            break;
          }
        }
      },
      error => this.verifyStatusError(error),
    );
  }

  requestAdoption() {
    if (!this.loggedPerson) {
      this.routerService.navigateByUrl('/account/login');
      return;
    }
    this.adoptionService.createAdoptionRequest(this.animalShow).subscribe(
      (data: AdoptionReceivedModel) => {
        this.adotionRequestCreated = data;
        this.toast.success('Solicitação enviada');
      },
      error => this.verifyStatusError(error),
    );
  }

  cancelAdoption() {
    this.adoptionService.deleteAdoptionRequest(this.animalShow, this.adotionRequestCreated!).subscribe(
      data => {
        this.adotionRequestCreated = undefined;
        this.toast.success('Solicitação cancelada');
      },
      error => this.verifyStatusError(error),
    );
  }

  notFoundRedirect() {
    this.routerService.navigateByUrl('/404', { replaceUrl: true });
  }

  serverPhoto(photo: string): string {
    return `${environment.API}${photo}`;
  }

  openModal(template: TemplateRef<any>) {
    this.modalRef = this.modalService.show(template, { class: 'modal-lg' });
  }

  showAnimal(photo: string, template: TemplateRef<any>) {
    this.selectedPhoto = this.serverPhoto(photo);
    this.modalRef = this.modalService.show(template, { class: 'modal-lg' });
  }

  toggleBlockAnimal() {
    if (this.animalShow.blocked) {
      this.animalService.unlockAnimal(this.animalShow).subscribe(
        data => this.animalShow.blocked = false,
        errors => this.verifyStatusError(errors),
      );
    } else {
      const reason = this.formBlockAnimal.get('reason')?.value;
      this.animalService.blockAnimal(this.animalShow, reason).subscribe(
        data => this.animalShow.blocked = true,
        errors => this.verifyStatusError(errors),
      );
      this.decline();
    }
  }

  decline(): void {
    this.modalRef?.hide();
  }

  verifyStatusError(errors: any) {
    if (errors.status >= 500) {
      this.toast.error('Servidor indisponível');
    } else if (errors.status == 404) {
      this.notFoundRedirect();
    } else if (errors.status == 406) {
      if (errors.error.errors) {
        for (let error of errors.error.errors) {
          this.toast.error(error);
        }
      }
    } else if (errors.status == 403) {
      this.toast.error('Sem permissão');
    } else {
      this.toast.error('Erro interno');
      console.log(errors);
    }
  }

}
